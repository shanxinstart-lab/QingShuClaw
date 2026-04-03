import Foundation
import AVFoundation

private struct VoiceInfo: Encodable {
  let identifier: String
  let name: String
  let language: String
  let quality: String
  let isPersonalVoice: Bool
}

private struct JsonEvent: Encodable {
  let type: String
  let voiceId: String?
  let code: String?
  let message: String?
  let voices: [VoiceInfo]?
}

private func emit(
  type: String,
  voiceId: String? = nil,
  code: String? = nil,
  message: String? = nil,
  voices: [VoiceInfo]? = nil
) {
  let event = JsonEvent(
    type: type,
    voiceId: voiceId,
    code: code,
    message: message,
    voices: voices
  )

  let encoder = JSONEncoder()
  guard let data = try? encoder.encode(event), let line = String(data: data, encoding: .utf8) else {
    return
  }
  FileHandle.standardOutput.write(Data((line + "\n").utf8))
}

private func readStandardInput() -> String {
  let data = FileHandle.standardInput.readDataToEndOfFile()
  return String(data: data, encoding: .utf8) ?? ""
}

private func mapVoiceQuality(_ voice: AVSpeechSynthesisVoice) -> String {
  let rawValue = voice.quality.rawValue
  if rawValue >= 2 {
    return "premium"
  }
  if rawValue == 1 {
    return "enhanced"
  }
  return "default"
}

private func isPersonalVoice(_ voice: AVSpeechSynthesisVoice) -> Bool {
  if #available(macOS 14.0, *) {
    return voice.voiceTraits.contains(.isPersonalVoice)
  }
  return false
}

private func listVoices() {
  let voices = AVSpeechSynthesisVoice.speechVoices().map { voice in
    VoiceInfo(
      identifier: voice.identifier,
      name: voice.name,
      language: voice.language,
      quality: isPersonalVoice(voice) ? "personal" : mapVoiceQuality(voice),
      isPersonalVoice: isPersonalVoice(voice)
    )
  }
  emit(type: "voices", voices: voices)
}

private final class SynthesizerDelegate: NSObject, AVSpeechSynthesizerDelegate {
  private let synthesizer = AVSpeechSynthesizer()
  private let voiceId: String?

  init(voiceId: String?) {
    self.voiceId = voiceId
    super.init()
    synthesizer.delegate = self
  }

  func speak(text: String, rate: Float, volume: Float) {
    let utterance = AVSpeechUtterance(string: text)
    if let voiceId, !voiceId.isEmpty, let voice = AVSpeechSynthesisVoice(identifier: voiceId) {
      utterance.voice = voice
    }
    utterance.rate = max(0.0, min(rate, 1.0))
    utterance.volume = max(0.0, min(volume, 1.0))
    synthesizer.speak(utterance)
  }

  func stop() {
    synthesizer.stopSpeaking(at: .immediate)
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
    emit(type: "speaking", voiceId: utterance.voice?.identifier ?? voiceId)
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    emit(type: "stopped", voiceId: utterance.voice?.identifier ?? voiceId)
    exit(0)
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    emit(type: "stopped", voiceId: utterance.voice?.identifier ?? voiceId)
    exit(0)
  }
}

private var activeSynthesizerDelegate: SynthesizerDelegate?

private func runSpeak(arguments: [String]) {
  let voiceId = arguments.count > 2 ? arguments[2] : nil
  let rate = arguments.count > 3 ? Float(arguments[3]) ?? 0.5 : 0.5
  let volume = arguments.count > 4 ? Float(arguments[4]) ?? 1.0 : 1.0
  let text = readStandardInput().trimmingCharacters(in: .whitespacesAndNewlines)

  guard !text.isEmpty else {
    emit(type: "error", code: "empty_text", message: "No text was provided for speech synthesis.")
    exit(1)
  }

  let delegate = SynthesizerDelegate(voiceId: voiceId)
  activeSynthesizerDelegate = delegate
  signal(SIGTERM) { _ in
    activeSynthesizerDelegate?.stop()
    exit(0)
  }
  delegate.speak(text: text, rate: rate, volume: volume)
  RunLoop.main.run()
}

let command = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "voices"

switch command {
case "voices":
  listVoices()
case "speak":
  runSpeak(arguments: CommandLine.arguments)
default:
  emit(type: "error", code: "unsupported_command", message: "Unsupported command: \(command)")
  exit(1)
}
