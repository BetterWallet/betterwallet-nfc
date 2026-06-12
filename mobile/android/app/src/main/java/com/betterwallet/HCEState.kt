package com.betterwallet

import com.facebook.react.bridge.ReactApplicationContext
import java.io.ByteArrayOutputStream

object HCEState {
    var pendingPayload: ByteArray? = null
    var reactContext: ReactApplicationContext? = null
    var writeBuffer = ByteArrayOutputStream()
}
