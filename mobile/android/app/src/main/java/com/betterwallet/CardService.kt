package com.betterwallet

import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.ByteArrayOutputStream
import org.json.JSONObject

class CardService : HostApduService() {
    private var lastReadProgressBytes = -1
    private var lastWriteProgressBytes = -1

    override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
        if (commandApdu == null || commandApdu.isEmpty()) return STATUS_FAILED

        if (commandApdu[0] == 0x00.toByte() && commandApdu.getOrNull(1) == 0xA4.toByte()) {
            HCEState.writeBuffer = ByteArrayOutputStream()
            lastReadProgressBytes = -1
            lastWriteProgressBytes = -1
            emitEvent("HCE_NFC_SESSION", "active")
            return STATUS_OK
        }

        return when (commandApdu[0].toInt() and 0xFF) {
            0x01 -> {
                val payload = HCEState.pendingPayload ?: return STATUS_FAILED
                byteArrayOf((payload.size shr 8).toByte(), payload.size.toByte()) + STATUS_OK
            }

            0x02 -> {
                val payload = HCEState.pendingPayload ?: return STATUS_FAILED
                if (commandApdu.size < 3) return STATUS_FAILED
                val offset = ((commandApdu[1].toInt() and 0xFF) shl 8) or (commandApdu[2].toInt() and 0xFF)
                if (offset >= payload.size) return STATUS_OK
                val nextOffset = minOf(offset + 200, payload.size)
                emitReadProgress(nextOffset, payload.size)
                payload.copyOfRange(offset, nextOffset) + STATUS_OK
            }

            0x03 -> {
                val data = commandApdu.copyOfRange(1, commandApdu.size)
                HCEState.writeBuffer.write(data)
                emitWriteProgress(HCEState.writeBuffer.size())
                STATUS_OK
            }

            0x04 -> {
                val received = HCEState.writeBuffer.toByteArray()
                emitTransferProgress("fromWallet", received.size, received.size)
                emitEvent("HCE_SIGNED_TX", String(received, Charsets.UTF_8))
                HCEState.writeBuffer = ByteArrayOutputStream()
                STATUS_OK
            }

            else -> STATUS_UNKNOWN
        }
    }

    override fun onDeactivated(reason: Int) {
        lastReadProgressBytes = -1
        lastWriteProgressBytes = -1
        emitEvent("HCE_NFC_SESSION", "idle")
    }

    private fun emitReadProgress(bytesTransferred: Int, totalBytes: Int) {
        val shouldEmit = bytesTransferred == totalBytes ||
            lastReadProgressBytes < 0 ||
            bytesTransferred - lastReadProgressBytes >= 200
        if (!shouldEmit) return
        lastReadProgressBytes = bytesTransferred
        emitTransferProgress("toWallet", bytesTransferred, totalBytes)
    }

    private fun emitWriteProgress(bytesTransferred: Int) {
        val shouldEmit = lastWriteProgressBytes < 0 || bytesTransferred - lastWriteProgressBytes >= 200
        if (!shouldEmit) return
        lastWriteProgressBytes = bytesTransferred
        emitTransferProgress("fromWallet", bytesTransferred, null)
    }

    private fun emitTransferProgress(direction: String, bytesTransferred: Int, totalBytes: Int?) {
        val payload = JSONObject()
            .put("direction", direction)
            .put("bytesTransferred", bytesTransferred)
        if (totalBytes != null) {
            payload.put("totalBytes", totalBytes)
        }
        emitEvent("HCE_TRANSFER_PROGRESS", payload.toString())
    }

    private fun emitEvent(name: String, payload: String) {
        HCEState.reactContext
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(name, payload)
    }

    companion object {
        private val STATUS_OK = byteArrayOf(0x90.toByte(), 0x00)
        private val STATUS_FAILED = byteArrayOf(0x67.toByte(), 0x00)
        private val STATUS_UNKNOWN = byteArrayOf(0x6D.toByte(), 0x00)
    }
}
