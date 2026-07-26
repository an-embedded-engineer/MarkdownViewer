export const imageViewerMaximumScale = 8;
export const imageViewerButtonZoomInFactor = 1.25;
export const imageViewerButtonZoomOutFactor = 0.8;

export type ImageViewerMode = "fit" | "custom";

export type ImageViewerTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
  mode: ImageViewerMode;
};

export type ImageViewerGeometry = {
  intrinsicWidth: number;
  intrinsicHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  padding: number;
};

export type ImageViewerPoint = {
  x: number;
  y: number;
};

export type IntrinsicSize = {
  width: number;
  height: number;
};

export type IntrinsicSizeCandidates = {
  viewBox?: IntrinsicSize | null;
  explicit?: IntrinsicSize | null;
  bounds?: IntrinsicSize | null;
};

export type ImageViewerSourceKind = "image" | "mermaid" | "plantuml";

export type ImageViewerRequest = {
  kind: ImageViewerSourceKind;
  accessibleName: string;
  intrinsicWidth: number;
  intrinsicHeight: number;
  visual: HTMLImageElement | SVGSVGElement;
  focusOrigin: HTMLButtonElement;
  tabId: string;
  revision: number;
};

export type ImageViewerDomAdapter = {
  decorate: () => void;
  cleanup: () => void;
};

type DomAdapterOptions = {
  tabId: string;
  revision: number;
  documentPath: string;
};

function requirePositiveFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number.`);
  }
  return value;
}

function validateGeometry(geometry: ImageViewerGeometry): void {
  requirePositiveFinite(geometry.intrinsicWidth, "intrinsicWidth");
  requirePositiveFinite(geometry.intrinsicHeight, "intrinsicHeight");
  requirePositiveFinite(geometry.viewportWidth, "viewportWidth");
  requirePositiveFinite(geometry.viewportHeight, "viewportHeight");
  if (!Number.isFinite(geometry.padding) || geometry.padding < 0) {
    throw new RangeError("padding must be a non-negative finite number.");
  }
  if (
    geometry.viewportWidth <= geometry.padding * 2 ||
    geometry.viewportHeight <= geometry.padding * 2
  ) {
    throw new RangeError("padding must leave a positive available viewport size.");
  }
}

function validateTransform(transform: ImageViewerTransform): void {
  requirePositiveFinite(transform.scale, "scale");
  if (!Number.isFinite(transform.offsetX) || !Number.isFinite(transform.offsetY)) {
    throw new RangeError("offsets must be finite numbers.");
  }
}

export function getImageViewerFitScale(geometry: ImageViewerGeometry): number {
  validateGeometry(geometry);
  const availableWidth = geometry.viewportWidth - geometry.padding * 2;
  const availableHeight = geometry.viewportHeight - geometry.padding * 2;
  return Math.min(
    1,
    availableWidth / geometry.intrinsicWidth,
    availableHeight / geometry.intrinsicHeight,
  );
}

export function createImageViewerFitTransform(
  geometry: ImageViewerGeometry,
): ImageViewerTransform {
  return {
    scale: getImageViewerFitScale(geometry),
    offsetX: 0,
    offsetY: 0,
    mode: "fit",
  };
}

export function createImageViewerResetTransform(
  geometry: ImageViewerGeometry,
): ImageViewerTransform {
  const fitScale = getImageViewerFitScale(geometry);
  return {
    scale: Math.min(imageViewerMaximumScale, Math.max(fitScale, 1)),
    offsetX: 0,
    offsetY: 0,
    mode: "custom",
  };
}

export function getImageViewerPanBounds(
  geometry: ImageViewerGeometry,
  scale: number,
): ImageViewerPoint {
  validateGeometry(geometry);
  requirePositiveFinite(scale, "scale");
  const availableWidth = geometry.viewportWidth - geometry.padding * 2;
  const availableHeight = geometry.viewportHeight - geometry.padding * 2;
  return {
    x: Math.max(0, (geometry.intrinsicWidth * scale - availableWidth) / 2),
    y: Math.max(0, (geometry.intrinsicHeight * scale - availableHeight) / 2),
  };
}

export function clampImageViewerTransform(
  transform: ImageViewerTransform,
  geometry: ImageViewerGeometry,
): ImageViewerTransform {
  validateTransform(transform);
  const fitScale = getImageViewerFitScale(geometry);
  const scale = Math.min(imageViewerMaximumScale, Math.max(fitScale, transform.scale));
  const bounds = getImageViewerPanBounds(geometry, scale);
  return {
    scale,
    offsetX: Math.min(bounds.x, Math.max(-bounds.x, transform.offsetX)),
    offsetY: Math.min(bounds.y, Math.max(-bounds.y, transform.offsetY)),
    mode: transform.mode,
  };
}

export function zoomImageViewerTransform(
  transform: ImageViewerTransform,
  geometry: ImageViewerGeometry,
  factor: number,
  anchor: ImageViewerPoint = { x: 0, y: 0 },
): ImageViewerTransform {
  validateTransform(transform);
  requirePositiveFinite(factor, "factor");
  if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
    throw new RangeError("zoom anchor must contain finite coordinates.");
  }

  const fitScale = getImageViewerFitScale(geometry);
  const scale = Math.min(
    imageViewerMaximumScale,
    Math.max(fitScale, transform.scale * factor),
  );
  const ratio = scale / transform.scale;
  return clampImageViewerTransform(
    {
      scale,
      offsetX: anchor.x - (anchor.x - transform.offsetX) * ratio,
      offsetY: anchor.y - (anchor.y - transform.offsetY) * ratio,
      mode: "custom",
    },
    geometry,
  );
}

export function panImageViewerTransform(
  transform: ImageViewerTransform,
  geometry: ImageViewerGeometry,
  delta: ImageViewerPoint,
): ImageViewerTransform {
  validateTransform(transform);
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
    throw new RangeError("pan delta must contain finite coordinates.");
  }
  return clampImageViewerTransform(
    {
      ...transform,
      offsetX: transform.offsetX + delta.x,
      offsetY: transform.offsetY + delta.y,
      mode: "custom",
    },
    geometry,
  );
}

export function resizeImageViewerTransform(
  transform: ImageViewerTransform,
  geometry: ImageViewerGeometry,
): ImageViewerTransform {
  return transform.mode === "fit"
    ? createImageViewerFitTransform(geometry)
    : clampImageViewerTransform(transform, geometry);
}

export function getImageViewerWheelFactor(
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
): number {
  if (!Number.isFinite(deltaY)) {
    throw new RangeError("wheel delta must be finite.");
  }
  requirePositiveFinite(viewportHeight, "viewportHeight");
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? viewportHeight : 1;
  const normalizedDelta = Math.min(100, Math.max(-100, deltaY * unit));
  return Math.exp(-normalizedDelta * 0.002);
}

function isValidIntrinsicSize(size: IntrinsicSize | null | undefined): size is IntrinsicSize {
  return Boolean(
    size &&
      Number.isFinite(size.width) &&
      size.width > 0 &&
      Number.isFinite(size.height) &&
      size.height > 0,
  );
}

export function resolveIntrinsicSize(
  candidates: IntrinsicSizeCandidates,
): IntrinsicSize | null {
  for (const candidate of [candidates.viewBox, candidates.explicit, candidates.bounds]) {
    if (isValidIntrinsicSize(candidate)) {
      return { width: candidate.width, height: candidate.height };
    }
  }
  return null;
}

function readSvgIntrinsicSize(svg: SVGSVGElement): IntrinsicSize | null {
  const viewBox = svg.viewBox?.baseVal;
  const bounds = svg.getBoundingClientRect();
  return resolveIntrinsicSize({
    viewBox: viewBox ? { width: viewBox.width, height: viewBox.height } : null,
    explicit: { width: svg.width.baseVal.value, height: svg.height.baseVal.value },
    bounds: { width: bounds.width, height: bounds.height },
  });
}

function setTriggerPosition(
  button: HTMLButtonElement,
  visual: HTMLImageElement | SVGSVGElement,
  previewPane: HTMLElement,
  fallbackRoot: HTMLElement,
): void {
  if (!visual.isConnected) {
    button.remove();
    fallbackRoot.focus();
    return;
  }
  const visualRect = visual.getBoundingClientRect();
  const previewRect = previewPane.getBoundingClientRect();
  const right = Math.min(previewRect.right - 8, Math.max(previewRect.left + 160, visualRect.right - 8));
  const top = Math.min(previewRect.bottom - 44, Math.max(previewRect.top + 8, visualRect.top + 8));
  button.style.setProperty("--image-viewer-trigger-left", `${right}px`);
  button.style.setProperty("--image-viewer-trigger-top", `${top}px`);
}

function createViewerButton(
  id: string,
  label: string,
  visual: HTMLImageElement | SVGSVGElement,
  previewPane: HTMLElement,
  fallbackRoot: HTMLElement,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "image-viewer-trigger";
  button.dataset.imageViewerId = id;
  button.dataset.imageViewerTrigger = "true";
  button.setAttribute("aria-label", label);
  button.textContent = "Open image viewer";

  let frame: number | null = null;
  const update = () => {
    if (frame !== null) {
      window.cancelAnimationFrame(frame);
    }
    frame = window.requestAnimationFrame(() => {
      frame = null;
      setTriggerPosition(button, visual, previewPane, fallbackRoot);
    });
  };
  const startTracking = () => {
    update();
    previewPane.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
  };
  const stopTracking = () => {
    previewPane.removeEventListener("scroll", update, true);
    window.removeEventListener("resize", update);
    if (frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }
  };
  button.addEventListener("focus", startTracking);
  button.addEventListener("blur", stopTracking);
  button.addEventListener("image-viewer-cleanup", stopTracking);
  return button;
}

export function createImageViewerDomAdapter(
  root: HTMLElement,
  options: DomAdapterOptions,
): ImageViewerDomAdapter {
  let sequence = 0;
  let disposed = false;
  const managedVisuals = new Set<HTMLImageElement | SVGSVGElement>();
  const managedTargets = new Set<HTMLElement>();
  const managedButtons = new Set<HTMLButtonElement>();
  const pendingImages = new Map<
    HTMLImageElement,
    { load: () => void; error: () => void }
  >();
  const warned = new Set<string>();
  const previewPane = root.closest<HTMLElement>(".preview-pane") ?? root;

  const warn = (kind: ImageViewerSourceKind, reason: string) => {
    const key = `${kind}:${reason}`;
    if (warned.has(key)) {
      return;
    }
    warned.add(key);
    console.warn(`[image viewer] ${options.documentPath} (${kind}): ${reason}`);
  };

  const decorate = (
    kind: ImageViewerSourceKind,
    visual: HTMLImageElement | SVGSVGElement,
    target: HTMLElement,
    host: HTMLElement,
    accessibleName: string,
  ) => {
    if (disposed || visual.dataset.imageViewerId) {
      return;
    }
    const size =
      visual instanceof HTMLImageElement
        ? resolveIntrinsicSize({
            explicit: { width: visual.naturalWidth, height: visual.naturalHeight },
          })
        : readSvgIntrinsicSize(visual);
    if (!size) {
      warn(kind, "rendered visual has no valid intrinsic size");
      return;
    }

    const id = `${options.tabId}:${options.revision}:${sequence++}`;
    visual.dataset.imageViewerId = id;
    visual.dataset.imageViewerKind = kind;
    target.dataset.imageViewerId = id;
    target.dataset.imageViewerTarget = "true";
    const button = createViewerButton(id, accessibleName, visual, previewPane, root);
    host.insertAdjacentElement("afterend", button);
    managedVisuals.add(visual);
    managedTargets.add(target);
    managedButtons.add(button);
  };

  const observeImage = (image: HTMLImageElement) => {
    if (pendingImages.has(image)) {
      return;
    }
    const remove = () => {
      const listeners = pendingImages.get(image);
      if (!listeners) {
        return;
      }
      image.removeEventListener("load", listeners.load);
      image.removeEventListener("error", listeners.error);
      pendingImages.delete(image);
    };
    const load = () => {
      remove();
      decorateAll();
    };
    const error = () => {
      remove();
      warn("image", "image asset failed to load");
    };
    pendingImages.set(image, { load, error });
    image.addEventListener("load", load, { once: true });
    image.addEventListener("error", error, { once: true });
  };

  const decorateAll = () => {
    if (disposed) {
      return;
    }
    root.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      if (image.dataset.imageViewerId) {
        return;
      }
      if (!image.complete) {
        observeImage(image);
        return;
      }
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        warn("image", "image asset completed without valid dimensions");
        return;
      }
      const anchor = image.closest<HTMLAnchorElement>("a");
      const label = image.alt
        ? `Open image in image viewer: ${image.alt}`
        : "Open Markdown image in image viewer";
      decorate("image", image, image, anchor ?? image, label);
    });

    root.querySelectorAll<HTMLElement>('.mermaid[data-processed="true"]').forEach((container) => {
      const svg = container.querySelector<SVGSVGElement>(":scope > svg");
      if (svg) {
        decorate("mermaid", svg, container, container, "Open Mermaid diagram in image viewer");
      }
    });

    root.querySelectorAll<HTMLElement>(".plantuml-diagram").forEach((container) => {
      const svg = container.querySelector<SVGSVGElement>(":scope > svg");
      if (svg) {
        decorate(
          "plantuml",
          svg,
          container,
          container,
          "Open PlantUML diagram in image viewer",
        );
      }
    });
  };

  return {
    decorate: decorateAll,
    cleanup: () => {
      disposed = true;
      pendingImages.forEach((listeners, image) => {
        image.removeEventListener("load", listeners.load);
        image.removeEventListener("error", listeners.error);
      });
      pendingImages.clear();
      managedButtons.forEach((button) => {
        button.dispatchEvent(new Event("image-viewer-cleanup"));
        button.remove();
      });
      managedTargets.forEach((target) => {
        delete target.dataset.imageViewerId;
        delete target.dataset.imageViewerTarget;
      });
      managedVisuals.forEach((visual) => {
        delete visual.dataset.imageViewerId;
        delete visual.dataset.imageViewerKind;
      });
      managedButtons.clear();
      managedTargets.clear();
      managedVisuals.clear();
    },
  };
}

export function resolveImageViewerSource(
  eventTarget: EventTarget | null,
  root: HTMLElement,
  tabId: string,
  revision: number,
): ImageViewerRequest | null {
  if (!(eventTarget instanceof Element) || !root.contains(eventTarget)) {
    return null;
  }
  const origin = eventTarget.closest<HTMLElement>(
    "[data-image-viewer-target], [data-image-viewer-trigger]",
  );
  const id = origin?.dataset.imageViewerId;
  if (!origin || !id || !root.contains(origin)) {
    return null;
  }
  const visuals = Array.from(
    root.querySelectorAll<HTMLImageElement | SVGSVGElement>("img[data-image-viewer-kind], svg[data-image-viewer-kind]"),
  ).filter((visual) => visual.dataset.imageViewerId === id);
  const buttons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("button[data-image-viewer-trigger]"),
  ).filter((button) => button.dataset.imageViewerId === id);
  if (visuals.length !== 1 || buttons.length !== 1) {
    return null;
  }
  const visual = visuals[0];
  const focusOrigin = buttons[0];
  const kind = visual.dataset.imageViewerKind;
  if (kind !== "image" && kind !== "mermaid" && kind !== "plantuml") {
    return null;
  }
  const size =
    visual instanceof HTMLImageElement
      ? resolveIntrinsicSize({
          explicit: { width: visual.naturalWidth, height: visual.naturalHeight },
        })
      : readSvgIntrinsicSize(visual);
  if (!size) {
    return null;
  }
  return {
    kind,
    accessibleName: focusOrigin.getAttribute("aria-label") ?? "Open image viewer",
    intrinsicWidth: size.width,
    intrinsicHeight: size.height,
    visual,
    focusOrigin,
    tabId,
    revision,
  };
}
