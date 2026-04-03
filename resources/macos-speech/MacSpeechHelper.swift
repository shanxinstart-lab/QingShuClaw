import Foundation
import Speech
import AVFoundation
import Dispatch

private struct JsonEvent: Encodable {
  let type: String
  let text: String?
  let code: String?
  let message: String?
  let supported: Bool?
  let speechAuthorization: String?
  let microphoneAuthorization: String?
  let locale: String?
}

private func emit(
  type: String,
  text: String? = nil,
  code: String? = nil,
  message: String? = nil,
  supported: Bool? = nil,
  speechAuthorization: String? = nil,
  microphoneAuthorization: String? = nil,
  locale: String? = nil
) {
  let event = JsonEvent(
    type: type,
    text: text,
    code: code,
    message: message,
    supported: supported,
    speechAuthorization: speechAuthorization,
    microphoneAuthorization: microphoneAuthorization,
    locale: locale
  )

  let encoder = JSONEncoder()
  guard let data = try? encoder.encode(event), let line = String(data: data, encoding: .utf8) else {
    return
  }
  FileHandle.standardOutput.write(Data((line + "\n").utf8))
}

private func mapSpeechAuthorization(_ status: SFSpeechRecognizerAuthorizationStatus) -> String {
  switch status {
  case .authorized:
    return "granted"
  case .denied:
    return "denied"
  case .restricted:
    return "restricted"
  case .notDetermined:
    return "not-determined"
  @unknown default:
    return "unsupported"
  }
}

private func mapMicrophoneAuthorization(_ status: AVAuthorizationStatus) -> String {
  switch status {
  case .authorized:
    return "granted"
  case .denied:
    return "denied"
  case .restricted:
    return "restricted"
  case .notDetermined:
    return "not-determined"
  @unknown default:
    return "unsupported"
  }
}

private func resolveRequestedLocale() -> Locale {
  if CommandLine.arguments.count > 2 {
    return Locale(identifier: CommandLine.arguments[2])
  }
  if let preferred = Locale.preferredLanguages.first, !preferred.isEmpty {
    return Locale(identifier: preferred)
  }
  return Locale.current
}

private func emitAvailability() {
  let locale = resolveRequestedLocale()
  let recognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))
  emit(
    type: "availability",
    supported: recognizer != nil,
    speechAuthorization: mapSpeechAuthorization(SFSpeechRecognizer.authorizationStatus()),
    microphoneAuthorization: mapMicrophoneAuthorization(AVCaptureDevice.authorizationStatus(for: .audio)),
    locale: recognizer?.locale.identifier ?? locale.identifier
  )
}

private func formatSpeechDiagnosticMessage(_ message: String, domain: String, code: Int) -> String {
  let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
  if trimmed.isEmpty {
    return "\(domain) error \(code)."
  }
  return "\(trimmed) [\(domain) \(code)]"
}

private func mapRecognitionError(_ error: Error) -> (code: String, message: String) {
  let nsError = error as NSError
  let message = formatSpeechDiagnosticMessage(
    nsError.localizedDescription,
    domain: nsError.domain,
    code: nsError.code
  )

  if nsError.domain == "kAFAssistantErrorDomain" {
    switch nsError.code {
    case 1101:
      return ("speech_process_invalidated", message)
    case 1107:
      return ("speech_process_interrupted", message)
    case 1110:
      return ("speech_no_match", message)
    default:
      break
    }
  }

  if nsError.domain == "kLSRErrorDomain" && nsError.code == 301 {
    return ("speech_request_cancelled", message)
  }

  return ("runtime_error", message)
}

private final class SpeechCoordinator {
  private let recognizer: SFSpeechRecognizer
  private let audioEngine = AVAudioEngine()
  private let request = SFSpeechAudioBufferRecognitionRequest()
  private var task: SFSpeechRecognitionTask?
  private var lastEmittedText = ""
  private var didFinish = false

  init(recognizer: SFSpeechRecognizer) {
    self.recognizer = recognizer
    self.recognizer.defaultTaskHint = .dictation
  }

  func start() throws {
    guard recognizer.isAvailable else {
      throw NSError(domain: "MacSpeechHelper", code: 1001, userInfo: [
        NSLocalizedDescriptionKey: "Speech recognizer is currently unavailable."
      ])
    }

    request.shouldReportPartialResults = true

    let inputNode = audioEngine.inputNode
    let format = inputNode.outputFormat(forBus: 0)
    inputNode.removeTap(onBus: 0)
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      self?.request.append(buffer)
    }

    audioEngine.prepare()
    try audioEngine.start()
    emit(type: "listening")

    task = recognizer.recognitionTask(with: request) { [weak self] result, error in
      guard let self else { return }
      if self.didFinish {
        return
      }

      if let error {
        self.stop()
        let mappedError = mapRecognitionError(error)
        emit(type: "error", code: mappedError.code, message: mappedError.message)
        exit(1)
      }

      guard let result else {
        return
      }

      let text = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
      if !text.isEmpty, text != self.lastEmittedText {
        self.lastEmittedText = text
        emit(type: result.isFinal ? "final" : "partial", text: text)
      }

      if result.isFinal {
        self.stop()
        exit(0)
      }
    }
  }

  func stop() {
    if didFinish {
      return
    }
    didFinish = true
    audioEngine.stop()
    audioEngine.inputNode.removeTap(onBus: 0)
    request.endAudio()
    task?.cancel()
    task = nil
  }
}

private var activeCoordinator: SpeechCoordinator?

private func requestSpeechAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
  let current = SFSpeechRecognizer.authorizationStatus()
  if current != .notDetermined {
    return current
  }

  return await withCheckedContinuation { continuation in
    SFSpeechRecognizer.requestAuthorization { status in
      continuation.resume(returning: status)
    }
  }
}

private func requestMicrophoneAuthorization() async -> AVAuthorizationStatus {
  let current = AVCaptureDevice.authorizationStatus(for: .audio)
  if current != .notDetermined {
    return current
  }

  let granted = await withCheckedContinuation { continuation in
    AVCaptureDevice.requestAccess(for: .audio) { allowed in
      continuation.resume(returning: allowed)
    }
  }
  return granted ? .authorized : .denied
}

private func runListen() async {
  let requestedLocale = resolveRequestedLocale()
  let recognizer = SFSpeechRecognizer(locale: requestedLocale) ?? SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))

  guard let recognizer else {
    emit(type: "error", code: "recognizer_unavailable", message: "Speech recognizer is unavailable for the requested locale.")
    exit(1)
  }

  let speechStatus = await requestSpeechAuthorization()
  guard speechStatus == .authorized else {
    emit(type: "error", code: "speech_permission_denied", message: "Speech recognition permission was denied.")
    exit(1)
  }

  let microphoneStatus = await requestMicrophoneAuthorization()
  guard microphoneStatus == .authorized else {
    emit(type: "error", code: "microphone_permission_denied", message: "Microphone permission was denied.")
    exit(1)
  }

  let coordinator = SpeechCoordinator(recognizer: recognizer)
  do {
    try coordinator.start()
    activeCoordinator = coordinator
  } catch {
    coordinator.stop()
    let nsError = error as NSError
    if nsError.domain == "MacSpeechHelper" && nsError.code == 1001 {
      emit(type: "error", code: "recognizer_unavailable", message: error.localizedDescription)
    } else {
      emit(type: "error", code: "start_failed", message: error.localizedDescription)
    }
    exit(1)
  }
}

signal(SIGTERM) { _ in
  activeCoordinator?.stop()
  exit(0)
}
signal(SIGINT) { _ in
  activeCoordinator?.stop()
  exit(0)
}

guard CommandLine.arguments.count > 1 else {
  emit(type: "error", code: "invalid_command", message: "Expected 'status' or 'listen'.")
  exit(1)
}

switch CommandLine.arguments[1] {
case "status":
  emitAvailability()
  exit(0)
case "listen":
  Task {
    await runListen()
  }
  dispatchMain()
default:
  emit(type: "error", code: "invalid_command", message: "Expected 'status' or 'listen'.")
  exit(1)
}
