import {
  useCallback,
  useLayoutEffect,
  useRef,
  type DependencyList,
  type MutableRefObject,
} from "react";

const STICK_THRESHOLD = 12;

function attachScrollListeners(
  el: HTMLDivElement,
  stickToBottomRef: MutableRefObject<boolean>,
  isAutoScrollingRef: MutableRefObject<boolean>,
  savedScrollTopRef: MutableRefObject<number>
) {
  let touchStartY = 0;

  const distanceFromBottom = () =>
    el.scrollHeight - el.scrollTop - el.clientHeight;

  const detachFromBottom = () => {
    stickToBottomRef.current = false;
    savedScrollTopRef.current = el.scrollTop;
  };

  const onWheel = (e: WheelEvent) => {
    if (e.deltaY < 0) detachFromBottom();
  };

  const onTouchStart = (e: TouchEvent) => {
    touchStartY = e.touches[0]?.clientY ?? 0;
  };

  const onTouchMove = (e: TouchEvent) => {
    const y = e.touches[0]?.clientY ?? touchStartY;
    if (y - touchStartY > 6) detachFromBottom();
  };

  const onPointerDown = () => {
    savedScrollTopRef.current = el.scrollTop;
    if (distanceFromBottom() > STICK_THRESHOLD) {
      detachFromBottom();
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Home") {
      detachFromBottom();
    }
  };

  const onScroll = () => {
    if (isAutoScrollingRef.current) return;

    savedScrollTopRef.current = el.scrollTop;
    stickToBottomRef.current = distanceFromBottom() <= STICK_THRESHOLD;
  };

  el.addEventListener("wheel", onWheel, { passive: true });
  el.addEventListener("touchstart", onTouchStart, { passive: true });
  el.addEventListener("touchmove", onTouchMove, { passive: true });
  el.addEventListener("pointerdown", onPointerDown, { passive: true });
  el.addEventListener("keydown", onKeyDown);
  el.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    el.removeEventListener("wheel", onWheel);
    el.removeEventListener("touchstart", onTouchStart);
    el.removeEventListener("touchmove", onTouchMove);
    el.removeEventListener("pointerdown", onPointerDown);
    el.removeEventListener("keydown", onKeyDown);
    el.removeEventListener("scroll", onScroll);
  };
}

/**
 * 聊天区自动滚底：用户向上滚动后，流式输出期间锁定当前阅读位置。
 */
export function useChatAutoScroll(deps: DependencyList) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const isAutoScrollingRef = useRef(false);
  const savedScrollTopRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    containerRef.current = node;

    if (node) {
      savedScrollTopRef.current = node.scrollTop;
      cleanupRef.current = attachScrollListeners(
        node,
        stickToBottomRef,
        isAutoScrollingRef,
        savedScrollTopRef
      );
    }
  }, []);

  const resetStickToBottom = useCallback(() => {
    stickToBottomRef.current = true;
    savedScrollTopRef.current = 0;
  }, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (stickToBottomRef.current) {
      isAutoScrollingRef.current = true;
      el.scrollTop = el.scrollHeight;
      savedScrollTopRef.current = el.scrollTop;
      requestAnimationFrame(() => {
        isAutoScrollingRef.current = false;
      });
    } else {
      el.scrollTop = savedScrollTopRef.current;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    containerRef: containerCallbackRef,
    resetStickToBottom,
  };
}
