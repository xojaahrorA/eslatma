package uz.universallife.os;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Barmoq izi / yuz bilan ochish plagini (BiometricPrompt)
        registerPlugin(BiometricPlugin.class);
    }

    @Override
    public void onResume() {
        super.onResume();
        // FLAG_SECURE: ilova mazmuni recents (so'nggi ilovalar) ekranida
        // ko'rinmaydi va skrinshot/ekran yozib olishda bloklanadi (maxfiylik).
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }
}
