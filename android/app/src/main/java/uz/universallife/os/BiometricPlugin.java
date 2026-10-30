package uz.universallife.os;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

/**
 * Barmoq izi / yuz bilan ochish (Android BiometricPrompt).
 * AndroidManifest'da USE_BIOMETRIC ruxsati talab qiladi.
 * Natija hech qanday biometrik ma'lumotni JS'ga qaytarmaydi —
 * faqat ok: true/false (maxfiylik tamoyillari, PRD 8.3).
 */
@CapacitorPlugin(name = "BiometricAuth")
public class BiometricPlugin extends Plugin {

    private boolean available = false;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        FragmentActivity activity = getActivity();
        if (activity == null) {
            JSObject r = new JSObject();
            r.put("available", false);
            r.put("reason", "no_activity");
            call.resolve(r);
            return;
        }
        try {
            BiometricManager bm = BiometricManager.from(activity);
            // BIOMETRIC_WEAK: barmoq izi ham, yuz skaneri ham (kuchli himoya darajasi)
            int can = bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK);
            available = can == BiometricManager.BIOMETRIC_SUCCESS;
            JSObject r = new JSObject();
            r.put("available", available);
            r.put("reason",
                    can == BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE ? "no_hardware"
                  : can == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ? "not_enrolled"
                  : can == BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE ? "hw_unavailable"
                  : "unknown");
            call.resolve(r);
        } catch (Exception e) {
            JSObject r = new JSObject();
            r.put("available", false);
            r.put("reason", "error");
            call.resolve(r);
        }
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        FragmentActivity activity = getActivity();
        if (activity == null) {
            call.resolve(new JSObject() {{ put("ok", false); }});
            return;
        }
        String title = call.getString("title", "Unlock");
        String reason = call.getString("reason", "");
        String cancel = call.getString("cancel", "Enter PIN");

        Executor executor = ContextCompat.getMainExecutor(activity);
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(reason)
                .setNegativeButtonText(cancel)
                .setAllowedAuthenticators(
                        BiometricManager.Authenticators.BIOMETRIC_WEAK)
                .build();

        BiometricPrompt prompt = new BiometricPrompt(activity, executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(
                            @NonNull BiometricPrompt.AuthenticationResult result) {
                        JSObject r = new JSObject();
                        r.put("ok", true);
                        call.resolve(r);
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        // FingerprintDialogCancelTag / user cancel ham ok:false qaytaradi
                        JSObject r = new JSObject();
                        r.put("ok", false);
                        r.put("code", errorCode);
                        call.resolve(r);
                    }
                });

        try {
            prompt.authenticate(info);
        } catch (Exception e) {
            JSObject r = new JSObject();
            r.put("ok", false);
            r.put("code", -1);
            call.resolve(r);
        }
    }
}
