// Reads the words on a page image with Apple's Vision framework (macOS), for the docs'
// mocks: `swift scripts/ocr-vision.swift <image> <width> <height> [language]`.
//
// Prints JSON: the lines Vision read, in its order, each its words, each word's text and
// its box in a Canvas `width` × `height` pixels (the image may be smaller: Vision's boxes
// are fractions of the image, so any size of the same picture gives the Canvas's own
// coordinates). Used by `scripts/build-paged-ocr.mjs`.

import AppKit
import Foundation
import Vision

let args = CommandLine.arguments
guard args.count >= 4,
  let width = Double(args[2]), let height = Double(args[3])
else {
  FileHandle.standardError.write("usage: ocr-vision.swift <image> <width> <height> [language]\n".data(using: .utf8)!)
  exit(2)
}
let language = args.count > 4 ? args[4] : "en-US"

guard let image = NSImage(contentsOfFile: args[1]),
  let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
else {
  FileHandle.standardError.write("cannot read \(args[1])\n".data(using: .utf8)!)
  exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = [language]

try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])

/// A box in the Canvas's pixels, from Vision's fractions (origin at the bottom left).
func box(_ rect: CGRect) -> [Int] {
  let x = rect.minX * width
  let y = (1 - rect.maxY) * height
  return [
    Int(x.rounded()), Int(y.rounded()),
    Int((rect.width * width).rounded()), Int((rect.height * height).rounded()),
  ]
}

var lines: [[String: Any]] = []
for observation in request.results ?? [] {
  guard let candidate = observation.topCandidates(1).first else { continue }
  let text = candidate.string
  var words: [[Any]] = []
  // Each word by its own box: the run of the line's text between spaces.
  var start = text.startIndex
  while start < text.endIndex {
    while start < text.endIndex, text[start].isWhitespace { start = text.index(after: start) }
    guard start < text.endIndex else { break }
    var end = start
    while end < text.endIndex, !text[end].isWhitespace { end = text.index(after: end) }
    if let found = try? candidate.boundingBox(for: start..<end) {
      words.append([String(text[start..<end])] + box(found.boundingBox))
    }
    start = end
  }
  if !words.isEmpty {
    lines.append(["text": text, "box": box(observation.boundingBox), "words": words])
  }
}

let json = try JSONSerialization.data(withJSONObject: ["lines": lines], options: [])
FileHandle.standardOutput.write(json)
