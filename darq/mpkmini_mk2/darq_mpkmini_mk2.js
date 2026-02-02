//-----------------------------------------------------------------------------
// 1. DRIVER SETUP - create driver object, midi ports and detection information
//-----------------------------------------------------------------------------

var midiremote_api = require('midiremote_api_v1')
console.log("MIDI REMOTE TEST")
var deviceDriver = midiremote_api.makeDeviceDriver('darq', 'MPK mini mk2', 'darq')

var midiInput = deviceDriver.mPorts.makeMidiInput();
var midiOutput = deviceDriver.mPorts.makeMidiOutput();

var scheduledTasks = [];

var padLEDNotes = [9,10,11,12,13,14,15,16];

// SySEx-ID-Response 
// [ F0 7E 7F 06 02 47 26 00 
//   19 00 22 00 22 00 00 00 
//   00 00 00 00 04 00 00 00
//   03 01 00 00 30 31 32 33
//   2C F7]

// Detection for WIN, WinRT and MAC
deviceDriver.makeDetectionUnit().detectPortPair(midiInput, midiOutput)
    .expectSysexIdentityResponse('47', '2600', '1900')

deviceDriver.mOnActivate = function(activeDevice) {
    console.log("activating!!!")
    
    testPadLEDs(activeDevice, midiOutput)
}

deviceDriver.mOnIdle = function (context) {
    var now = Date.now();
    for (var i = scheduledTasks.length - 1; i >= 0; i--) {
        var task = scheduledTasks[i];
        if (now >= task.time) {
            task.fn(context);
            scheduledTasks.splice(i, 1); // remove after execution
        }
    }
};

var surface = deviceDriver.mSurface


function schedule(fn, delayMs) {
    scheduledTasks.push({
        fn: fn,
        time: Date.now() + delayMs
    });
}

function setLED(activeDevice,ledNote,status)
{
    var velocity = 0
    if(status){
       velocity=127;
    } 
    midiOutput.sendMidi(activeDevice, [0x90, ledNote, velocity]);
}
function testPadLEDs(context, midiOutput) {

    var delayMs = 50;

    var index = 0;
    var round = 0;

    function triggerNext() {
        if (index >= padLEDNotes.length){
            index = 0;
            round++;
        }

        if (round >= 2) return;
        var note = padLEDNotes[index];
        midiOutput.sendMidi(context, [0x90, note, 127]);
        console.log("LED ON: " + note);

        schedule(function (context) {
            midiOutput.sendMidi(context, [0x90, note, 0]);
            console.log("LED OFF: " + note);

            index++;
            triggerNext();
        }, delayMs);
    }

    triggerNext();
}

//----------------------------------------------------------------------------------------------------------------------
// 2. SURFACE LAYOUT - create control elements and midi bindings
//----------------------------------------------------------------------------------------------------------------------

function Helper_getInnerCoordCentered(sizeOuter, sizeInner) {
    return (sizeOuter / 2 - sizeInner / 2)
}

var controlsMidiChannel = 0
var padMidiChannel = 0



var xBlindPanel = 0
var xBlindPanel2 = xBlindPanel + 1.2
var yBlindPanel = 1.8
var wBlindPanel = 1.1
var hBlindPanel = 0.7

var xBlindPanelRightSide = 11.1

var xFirstPad = xBlindPanel2 + wBlindPanel + 0.4
var yPad = 0
var padSize = 1.9

var wKnob = 1.7
var hKnob = 1.5
var xFirstKnob = 10.8

var joyStickSize = 1.75
var xJoystick = Helper_getInnerCoordCentered(xBlindPanel2 + wBlindPanel, joyStickSize)




// joystick for x- and y-axis
var joyStickXY = surface.makeJoyStickXY(xJoystick, 0, joyStickSize, joyStickSize);
joyStickXY.mY.mMidiBinding.setInputPort(midiInput).bindToPitchBend(controlsMidiChannel);
joyStickXY.mX.mMidiBinding.setInputPort(midiInput).bindToControlChange(controlsMidiChannel, 1);

// blind panels left side - ON/OFF - NOTE REPEAT
surface.makeBlindPanel(xBlindPanel, yBlindPanel, wBlindPanel, hBlindPanel) 
surface.makeBlindPanel(xBlindPanel2, yBlindPanel, wBlindPanel, hBlindPanel) 
yBlindPanel += 0.7

surface.makeBlindPanel(xBlindPanel, yBlindPanel, wBlindPanel, hBlindPanel)
surface.makeBlindPanel(xBlindPanel2, yBlindPanel, wBlindPanel, hBlindPanel)
yBlindPanel += 0.7

surface.makeBlindPanel(xBlindPanel, yBlindPanel, wBlindPanel, hBlindPanel)
surface.makeBlindPanel(xBlindPanel2, yBlindPanel, wBlindPanel, hBlindPanel)

// blind panels right side - BANK A/B - PROG SELECT
surface.makeBlindPanel(xBlindPanelRightSide, yBlindPanel, wBlindPanel, hBlindPanel)
xBlindPanelRightSide += 1.3

surface.makeBlindPanel(xBlindPanelRightSide, yBlindPanel, wBlindPanel, hBlindPanel)
xBlindPanelRightSide += 1.3

surface.makeBlindPanel(xBlindPanelRightSide, yBlindPanel, wBlindPanel, hBlindPanel)
xBlindPanelRightSide += 1.7

surface.makeBlindPanel(xBlindPanelRightSide, yBlindPanel, wBlindPanel, hBlindPanel)

// create trigger pads and knobs
var pads = []
var knobs = []
var numElements = 8

// C1 = 24 => 0x18
var firstPadNotePitchBankA = 0X18
var firstPadNotePitchBankB = 0X20
var firstPadCCBankACC = 10
var firstPadCCBankBCC = 18

var firstKnobCC = 2

// create control layer zones for a shifting-combination of modes A/B + CC
var padLayerZone = surface.makeControlLayerZone('Pads')
var padControlLayerACC = padLayerZone.makeControlLayer('Bank A + CC')
var padControlLayerBCC = padLayerZone.makeControlLayer('Bank B + CC')


for (var i = 0; i < numElements; ++i) {
    var row = 1- Math.floor(i / 4)
    var col = i % 4

    var xPads = col * 2 + xFirstPad
    var yPads = row * 2 + yPad
    
    var xKnobs = col * 1.7 + xFirstKnob
    var yKnobs = 1-row * 1.6


    // create pads for Bank A (green) with CC pressed 
    var padOfBankACC = surface.makeTriggerPad(xPads, yPads, padSize, padSize).setControlLayer(padControlLayerACC)
    padOfBankACC.mSurfaceValue.mMidiBinding.setInputPort(midiInput)
        .setOutputPort(midiOutput)
        .bindToControlChange(padMidiChannel, firstPadCCBankACC + i)

    // create pads for Bank B (red) with CC pressed 
    var padOfBankBCC = surface.makeTriggerPad(xPads, yPads, padSize, padSize).setControlLayer(padControlLayerBCC)
    padOfBankBCC.mSurfaceValue.mMidiBinding.setInputPort(midiInput)
        .setOutputPort(midiOutput)
        .bindToControlChange(padMidiChannel, firstPadCCBankBCC + i) 

    // 4x2 Device Control Knobs - right side
    var knob = surface.makeKnob(xKnobs, yKnobs, wKnob, hKnob)
    knob.mSurfaceValue.mMidiBinding.setInputPort(midiInput)
        .bindToControlChange(controlsMidiChannel, firstKnobCC + i)


    pads.push(padOfBankACC) // 0,2,4,6 .. will be pads A 1 A 2 ...
    pads.push(padOfBankBCC)

    knobs.push(knob)
}


// piano keys
surface.makePianoKeys(0, 4.5, 17.5, 4.5, 0, 24)



//----------------------------------------------------------------------------------------------------------------------
// 3. HOST MAPPING - create mapping pages and host bindings
//----------------------------------------------------------------------------------------------------------------------

var page = deviceDriver.mMapping.makePage('Default')
page.makeSubPageArea("")

// Start/Stop Button
page.makeValueBinding(pads[8].mSurfaceValue,page.mHostAccess.mTransport.mValue.mStart).setTypeToggle()

page.mHostAccess.mTransport.mValue.mStart.mOnProcessValueChange=function(activeDevice,activeMapping,value){
    setLED(activeDevice,padLEDNotes[4],value)
}

// Back/Forth Button
page.makeCommandBinding(pads[0].mSurfaceValue,'Transport', 'Step Back Bar')
page.makeCommandBinding(pads[1].mSurfaceValue,'Transport', 'Step Bar')


// Solo Button
page.makeValueBinding(pads[10].mSurfaceValue,page.mHostAccess.mTrackSelection.mMixerChannel.mValue.mSolo).setTypeToggle()

page.mHostAccess.mTrackSelection.mMixerChannel.mValue.mSolo.mOnProcessValueChange=function(activeDevice,activeMapping,value){
    setLED(activeDevice,padLEDNotes[5],value)
}

// Record Button
page.makeValueBinding(pads[6].mSurfaceValue,page.mHostAccess.mTransport.mValue.mRecord).setTypeToggle()
page.mHostAccess.mTransport.mValue.mRecord.mOnProcessValueChange=function(activeDevice,activeMapping,value){
    setLED(activeDevice,padLEDNotes[3],value)
}

// Instrument Button
page.makeValueBinding(pads[12].mSurfaceValue,page.mHostAccess.mTrackSelection.mMixerChannel.mInstrumentPluginSlot.mEdit).setTypeToggle()
page.mHostAccess.mTrackSelection.mMixerChannel.mInstrumentPluginSlot.mEdit.mOnProcessValueChange=function(activeDevice,activeMapping,value){
    setLED(activeDevice,padLEDNotes[6],value)
}

// Lock QuickControls
page.makeValueBinding(pads[14].mSurfaceValue,page.mHostAccess.mFocusedQuickControls.mFocusLockedValue).setTypeToggle()
page.mHostAccess.mFocusedQuickControls.mFocusLockedValue.mOnProcessValueChange=function(activeDevice,activeMapping,value){
    setLED(activeDevice,padLEDNotes[7],value)
}

// Write  Automation
page.makeValueBinding(pads[4].mSurfaceValue,page.mHostAccess.mTrackSelection.mMixerChannel.mValue.mAutomationWrite).setTypeToggle()
page.mHostAccess.mTrackSelection.mMixerChannel.mValue.mAutomationWrite.mOnProcessValueChange=function(activeDevice,activeMapping,value){
    setLED(activeDevice,padLEDNotes[2],value)
}


pads[0].mSurfaceValue.mOnProcessValueChange=function(activeDevice,value,diff){
    console.log("Press Pad A1")
    knobs.forEach(function(knob, i) {
        var qcValue = page.mHostAccess.mFocusedQuickControls.getByIndex(i+1)
        page.makeValueBinding(knob.mSurfaceValue, qcValue)
    })

}
   
pads[2].mSurfaceValue.mOnProcessValueChange=function(activeDevice,value,diff){
    console.log("Press Pad A2")
               
}
knobs.forEach(function(knob, i) {
    var qcValue = page.mHostAccess.mFocusedQuickControls.getByIndex(i)
    page.makeValueBinding(knob.mSurfaceValue, qcValue)
})

