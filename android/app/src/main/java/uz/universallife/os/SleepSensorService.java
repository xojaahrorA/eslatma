package uz.universallife.os;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileWriter;

/**
 * Uyqu kuzatuvi servisi (Foreground, "health" tipi).
 * Akselerometr har 60ms da o'lchaydi; har daqiqada harakat indeksi (0..100)
 * hisoblanib, ichki faylga yoziladi (filesDir/sleep_motion.json).
 * MA'LUMOT QAYERGA KETMAYDI: faqat ilovaning ichki xotirasi.
 *
 * Ekran o'chsa ham ishlashi uchun PARTIAL_WAKE_LOCK (14 soat chegara bilan).
 */
public class SleepSensorService extends Service implements SensorEventListener {

    public static final String ACTION_START = "uz.universallife.os.SLEEP_START";
    public static final String ACTION_STOP = "uz.universallife.os.SLEEP_STOP";
    public static final String EXTRA_SESSION = "sessionId";

    private static final String CHANNEL_ID = "sleep";
    private static final int NOTIF_ID = 2001;
    private static final long MAX_MS = 16L * 60 * 60 * 1000; // 16 soat xavfsiz chegara
    private static final float THRESHOLD = 0.35f; // m/s² — yotoqdagi mayda harakat

    public static volatile boolean running = false;

    private SensorManager sensorManager;
    private PowerManager.WakeLock wakeLock;
    private String sessionId = "s";
    private long startAt;
    private long minuteStart;
    private int moves;
    private float peak;
    private JSONArray minutes = new JSONArray();
    private int lastMinuteCount = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            flushFile();
            stopSelf();
            return START_NOT_STICKY;
        }
        if (intent == null) {
            // tizim qayta ishga tushirgan — sessiya holati yo'q, xavfsiz to'xtatamiz
            flushFile();
            stopSelf();
            return START_NOT_STICKY;
        }

        sessionId = intent.getStringExtra(EXTRA_SESSION);
        if (sessionId == null) sessionId = "s";
        startAt = System.currentTimeMillis();
        minuteStart = startAt;
        moves = 0;
        peak = 0f;
        minutes = new JSONArray();
        lastMinuteCount = 0;

        Notification n = buildNotification(0);
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH);
        } else if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH);
        } else {
            startForeground(NOTIF_ID, n);
        }

        // CPU'ni uxlatmaymiz (foydalanuvchi rozi — sensor rejimini o'zi yoqadi)
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ulos:sleep");
            wakeLock.acquire(MAX_MS);
        }

        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        Sensor acc = sensorManager != null ? sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) : null;
        if (acc != null) {
            sensorManager.registerListener(this, acc, SensorManager.SENSOR_DELAY_UI);
            running = true;
            flushFile(); // faylni toza holatga keltiramiz (eski sessiya qoldiqlari yo'q)
        } else {
            stopSelf();
        }
        return START_STICKY;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!running) return;
        float x = event.values[0];
        float y = event.values[1];
        float z = event.values[2];
        float v = (float) Math.sqrt(x * x + y * y + z * z);
        float dev = Math.abs(v - SensorManager.GRAVITY_EARTH);
        if (dev > THRESHOLD) {
            moves++;
            if (dev > peak) peak = dev;
        }
        long now = System.currentTimeMillis();
        if (now - minuteStart >= 60_000) {
            pushMinute();
            updateNotification(now);
            flushFile();
            if (now - startAt > MAX_MS) {
                stopSelf();
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        /* kerak emas */
    }

    /** Har daqiqa: harakatlar soni → indeks 0..100 */
    private void pushMinute() {
        try {
            JSONObject o = new JSONObject();
            o.put("t", minuteStart);
            o.put("mv", Math.min(100, moves * 2));
            o.put("pk", Math.min(100, Math.round(peak * 8f)));
            minutes.put(o);
        } catch (Exception ignored) {
        }
        moves = 0;
        peak = 0f;
        minuteStart += 60_000;
        lastMinuteCount++;
    }

    private void flushFile() {
        try {
            JSONObject root = new JSONObject();
            root.put("sessionId", sessionId);
            root.put("startAt", startAt);
            root.put("minutes", minutes);
            File f = new File(getFilesDir(), "sleep_motion.json");
            FileWriter w = new FileWriter(f, false);
            w.write(root.toString());
            w.close();
        } catch (Exception ignored) {
        }
    }

    private Notification buildNotification(int elapsedMin) {
        String text = elapsedMin > 0
                ? getString(R.string.sleep_tracking_elapsed, elapsedMin)
                : getString(R.string.sleep_tracking_active);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            b = new Notification.Builder(this, CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
        }
        b.setContentTitle(getString(R.string.sleep_tracking_title))
                .setContentText(text)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(PendingIntent.getActivity(
                        this, 0,
                        new Intent(this, MainActivity.class),
                        PendingIntent.FLAG_IMMUTABLE));
        return b.build();
    }

    private void updateNotification(long now) {
        long min = Math.max(1, (now - startAt) / 60_000);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIF_ID, buildNotification((int) min));
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID,
                    getString(R.string.sleep_channel_name),
                    NotificationManager.IMPORTANCE_LOW);
            ch.setDescription(getString(R.string.sleep_channel_desc));
            ch.setShowBadge(false);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    @Override
    public void onDestroy() {
        running = false;
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
        }
        flushFile();
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
