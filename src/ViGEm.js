//
// Connect to the ViGEm bus via the Foreign Function Interface

const ffi = require('ffi-napi')
const ref = require('ref-napi')
const StructType = require('ref-struct-napi')

// Native types
const PVIGEM_CLIENT = 'void *'
const PVIGEM_TARGET = 'void *'

// Xbox 360 update struct
const XUSB_REPORT = StructType()
XUSB_REPORT.defineProperty('wButtons', ref.types.ushort)
XUSB_REPORT.defineProperty('bLeftTrigger', ref.types.byte)
XUSB_REPORT.defineProperty('bRightTrigger', ref.types.byte)
XUSB_REPORT.defineProperty('sThumbLX', ref.types.short)
XUSB_REPORT.defineProperty('sThumbLY', ref.types.short)
XUSB_REPORT.defineProperty('sThumbRX', ref.types.short)
XUSB_REPORT.defineProperty('sThumbRY', ref.types.short)

// Native error codes
const VIGEM_ERROR = 'uint32'
const VIGEM_ERROR_NONE = 0x20000000
const VIGEM_ERROR_BUS_NOT_FOUND = 0xE0000001
const VIGEM_ERROR_NO_FREE_SLOT = 0xE0000002
const VIGEM_ERROR_INVALID_TARGET = 0xE0000003
const VIGEM_ERROR_REMOVAL_FAILED = 0xE0000004
const VIGEM_ERROR_ALREADY_CONNECTED = 0xE0000005
const VIGEM_ERROR_TARGET_UNINITIALIZED = 0xE0000006
const VIGEM_ERROR_TARGET_NOT_PLUGGED_IN = 0xE0000007
const VIGEM_ERROR_BUS_VERSION_MISMATCH = 0xE0000008
const VIGEM_ERROR_BUS_ACCESS_FAILED = 0xE0000009
const VIGEM_ERROR_CALLBACK_ALREADY_REGISTERED = 0xE0000010
const VIGEM_ERROR_CALLBACK_NOT_FOUND = 0xE0000011
const VIGEM_ERROR_BUS_ALREADY_CONNECTED = 0xE0000012
const VIGEM_ERROR_BUS_INVALID_HANDLE = 0xE0000013
const VIGEM_ERROR_XUSB_USERINDEX_OUT_OF_RANGE = 0xE0000014

// Define native functions
const native = ffi.Library('lib/ViGEmClient_x64.dll', {
    vigem_alloc: [PVIGEM_CLIENT, []],
    vigem_connect: [VIGEM_ERROR, [PVIGEM_CLIENT]],
    vigem_disconnect: ['void', [PVIGEM_CLIENT]],
    vigem_target_x360_alloc: [PVIGEM_TARGET, []],
    vigem_target_free: ['void', [PVIGEM_TARGET]],
    vigem_target_add: [VIGEM_ERROR, [PVIGEM_CLIENT, PVIGEM_TARGET]],
    vigem_target_remove: [VIGEM_ERROR, [PVIGEM_CLIENT, PVIGEM_TARGET]],
    vigem_target_x360_update: [VIGEM_ERROR, [PVIGEM_CLIENT, PVIGEM_TARGET, 'void *']]
})

module.exports = class ViGEm {

    /** Constructor */
    constructor() {

        // Init the ViGEm SDK
        this.client = native.vigem_alloc()

        // Connect
        handleError(native.vigem_connect(this.client))

    }

    /** 
     * Create a new controller.
     * 
     * @returns {Controller} The new Xbox 360 virtual controller.
     */
    createController() {

        // Create controller
        return new Controller(this)

    }

}

class Controller {

    /** Constructor */
    constructor(vigem) {

        // Store reference
        this.vigem = vigem

        // Create controller
        this.target = native.vigem_target_x360_alloc()

        // Connect it
        handleError(native.vigem_target_add(this.vigem.client, this.target))

        // Create report buffer
        this.report = new XUSB_REPORT()

    }

    /** Destroy */
    remove() {

        // Disconnect it
        handleError(native.vigem_target_remove(this.vigem.client, this.target))

        // Dealloc
        native.vigem_target_free(this.target)
        this.target = null

    }

    /** 
     * Update the controler values.
     * 
     * @param {object} values The values to use.
     * @param {float} values.lx Left stick X axis value, -1 to 1.
     * @param {float} values.ly Left stick Y axis value, -1 to 1.
     * @param {float} values.rx Right stick X axis value, -1 to 1.
     * @param {float} values.rx Right stick Y axis value, -1 to 1.
     * @param {bool} values.a Button pressed state.
     * @param {bool} values.b Button pressed state.
     * @param {bool} values.x Button pressed state.
     * @param {bool} values.y Button pressed state.
     * @param {bool} values.home Button pressed state. (Also "start" button)
     * @param {bool} values.menu Button pressed state. (also "back" button)
     * @param {bool} values.dpadUp Button pressed state.
     * @param {bool} values.dpadDown Button pressed state.
     * @param {bool} values.dpadLeft Button pressed state.
     * @param {bool} values.dpadRight Button pressed state.
     * @param {bool} values.leftBumper Button pressed state.
     * @param {bool} values.rightBumper Button pressed state.
     * @param {bool} values.leftThumb Button pressed state.
     * @param {bool} values.rightThumb Button pressed state.
     */
    update(values) {

        // Ensure values are within range
        values.leftTrigger = Math.min(1, Math.max(-1, values.leftTrigger)) || 0
        values.rightTrigger = Math.min(1, Math.max(-1, values.rightTrigger)) || 0
        values.lx = Math.min(1, Math.max(-1, values.lx)) || 0
        values.ly = Math.min(1, Math.max(-1, values.ly)) || 0
        values.rx = Math.min(1, Math.max(-1, values.rx)) || 0
        values.ry = Math.min(1, Math.max(-1, values.ry)) || 0

        // Set axis values
        this.report.bLeftTrigger = values.leftTrigger * 127
        this.report.bRightTrigger = values.rightTrigger * 127
        this.report.sThumbLX = values.lx * 32767
        this.report.sThumbLY = values.ly * 32767
        this.report.sThumbRX = values.rx * 32767
        this.report.sThumbRY = values.ry * 32767

        // Set values of buttons. These values can be found here: https://docs.microsoft.com/en-us/windows/win32/api/xinput/ns-xinput-xinput_gamepad#members
        this.report.wButtons = 0
        if (values.a) this.report.wButtons |= 0x1000
        if (values.b) this.report.wButtons |= 0x2000
        if (values.x) this.report.wButtons |= 0x4000
        if (values.y) this.report.wButtons |= 0x8000
        if (values.home) this.report.wButtons |= 0x0010
        if (values.menu) this.report.wButtons |= 0x0020
        if (values.dpadUp) this.report.wButtons |= 0x0001
        if (values.dpadDown) this.report.wButtons |= 0x0002
        if (values.dpadLeft) this.report.wButtons |= 0x0004
        if (values.dpadRight) this.report.wButtons |= 0x0008
        if (values.leftBumper) this.report.wButtons |= 0x0100
        if (values.rightBumper) this.report.wButtons |= 0x0200
        if (values.leftThumb) this.report.wButtons |= 0x0040
        if (values.rightThumb) this.report.wButtons |= 0x0080

        // Send update
        handleError(native.vigem_target_x360_update(this.vigem.client, this.target, this.report.ref()))

    }

}

/** @private Handle ViGEm error codes */
function handleError(result) {

    // Throw error if necessary
    if (result != VIGEM_ERROR_NONE)
        throw new Error(`Unable to connect to ViGEm bus. Error ${result}`)

}