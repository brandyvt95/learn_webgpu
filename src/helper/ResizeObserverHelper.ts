export class ResizeObserverHelper extends ResizeObserver {
  private element: Element;
  private callback: (width: number, height: number) => void;

  constructor(
    element: Element,
    callback: (width: number, height: number) => void
  ) {
    super((entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        if (entry.target !== element) continue;

        if ((entry as any).devicePixelContentBoxSize) {
          // Works in Chrome
          const devicePixelSize = (entry as any).devicePixelContentBoxSize[0];
          callback(devicePixelSize.inlineSize, devicePixelSize.blockSize);
        } else if (entry.contentBoxSize) {
          const contentBoxSize = Array.isArray(entry.contentBoxSize)
            ? entry.contentBoxSize[0]
            : entry.contentBoxSize;
          callback(contentBoxSize.inlineSize, contentBoxSize.blockSize);
        } else {
          callback(entry.contentRect.width, entry.contentRect.height);
        }
      }
    });

    this.element = element;
    this.callback = callback;

    this.observe(element);
  }
}
