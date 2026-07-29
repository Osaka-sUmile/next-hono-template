import "@testing-library/jest-dom"

// jsdom は Pointer Capture API と scrollIntoView を実装していないため、
// これらに依存する Radix UI コンポーネント（Sheet 等）のテスト用に補う。
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
}
