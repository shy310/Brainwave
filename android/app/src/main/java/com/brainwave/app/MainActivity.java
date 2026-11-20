package com.brainwave.app;

import android.os.Bundle;

import com.brainwave.app.recorder.LectureRecorderPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LectureRecorderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
