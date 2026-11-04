package uz.universallife.os;

import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;

/**
 * SleepSensor — uyqu kuzatuvi uchun akselerometr Foreground Service boshqaruvi.
 * start()  → servisni ishga tushiradi (har daqiqalik harakat yozuvi)
 * stop()   → to'xtatadi va yig'ilgan ma'lumotni JSON string qilib qaytaradi
 *            (ma'lumot ilova ichki xotirasidan — hech qayerga jo'natilmaydi)
 * available() → sensor mavjudligini tekshiradi (hech narsani ishga tushirmaydi)
 */
@CapacitorPlugin(name = "SleepSensor")
public class SleepSensorPlugin extends Plugin {

    @PluginMethod
    public void available(PluginCall call) {
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        JSObject r = new JSObject();
        if (sm == null || sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) == null) {
            r.put("ok", false);
            r.put("reason", "no_sensor");
        } else {
            r.put("ok", true);
        }
        call.resolve(r);
    }

    @PluginMethod
    public void start(PluginCall call) {
        String sessionId = call.getString("sessionId", "s");
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sm == null || sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) == null) {
            JSObject r = new JSObject();
            r.put("ok", false);
            r.put("reason", "no_sensor");
            call.resolve(r);
            return;
        }
        try {
            Intent i = new Intent(getContext(), SleepSensorService.class);
            i.setAction(SleepSensorService.ACTION_START);
            i.putExtra(SleepSensorService.EXTRA_SESSION, sessionId);
            ContextCompat.startForegroundService(getContext(), i);
            JSObject r = new JSObject();
            r.put("ok", true);
            call.resolve(r);
        } catch (Exception e) {
            JSObject r = new JSObject();
            r.put("ok", false);
            r.put("reason", "error");
            call.resolve(r);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        JSObject r = new JSObject();
        try {
            // fayl har daqiqada saqlangan — avval O'QIB OLAMIZ, keyin to'xtatamiz
            File f = new File(getContext().getFilesDir(), "sleep_motion.json");
            if (f.exists()) {
                String data = readFile(f);
                r.put("ok", data != null && data.length() > 2);
                if (data != null) r.put("data", data);
            } else {
                r.put("ok", false);
                r.put("reason", "no_data");
            }
        } catch (Exception e) {
            r.put("ok", false);
            r.put("reason", "error");
        }
        // servisdni to'xtatish (onDestroy ham faylni saqlaydi, lekin biz allaqachon o'qidik)
        try {
            Intent i = new Intent(getContext(), SleepSensorService.class);
            getContext().stopService(i);
        } catch (Exception ignored) {
        }
        // faylni tozalash — keyingi sessiya toza boshlanadi
        try {
            new File(getContext().getFilesDir(), "sleep_motion.json").delete();
        } catch (Exception ignored) {
        }
        call.resolve(r);
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("running", SleepSensorService.running);
        call.resolve(r);
    }

    private String readFile(File f) {
        FileInputStream in = null;
        try {
            in = new FileInputStream(f);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        } catch (Exception e) {
            return null;
        } finally {
            if (in != null) {
                try {
                    in.close();
                } catch (Exception ignored) {
                }
            }
        }
    }
}
