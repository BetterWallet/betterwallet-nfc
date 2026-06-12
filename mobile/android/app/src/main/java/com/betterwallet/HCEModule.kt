package com.betterwallet

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class HCEModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    init {
        HCEState.reactContext = reactContext
    }

    override fun getName(): String = "HCEModule"

    @ReactMethod
    fun setPayload(json: String) {
        HCEState.pendingPayload = json.toByteArray(Charsets.UTF_8)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required by RN EventEmitter interface.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required by RN EventEmitter interface.
    }
}
