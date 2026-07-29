import "@testing-library/jest-dom"

// jsdom は Pointer Capture API と scrollIntoView を実装していないため、
// これらに依存する Radix UI コンポーネント(DropdownMenu / Sheet 等)のテストが失敗する。
// テスト時のみ無害なスタブを当てて補う。
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
}

// jsdom は ResizeObserver も実装していない(Radix UI の Select 等が要求する)。
globalThis.ResizeObserver ??= class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
