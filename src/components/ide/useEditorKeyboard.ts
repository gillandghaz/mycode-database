"use client";

// Phones (iPhone especially): when the on-screen keyboard opens for the CODE
// EDITOR, the visible area shrinks and the fixed-height terminal at the bottom
// of the IDE ended up sitting right above the keyboard, covering the lines
// being typed. While that keyboard is open we size the IDE to the visible area
// and keep the terminal where it belongs (behind the keyboard, hidden), so the
// editor gets the whole visible height. When the keyboard closes, or the
// terminal's own input is focused, nothing changes.

import { useEffect, useState, type RefObject } from "react";
import { EditorView } from "@codemirror/view";

export interface EditorKeyboardState {
  open: boolean;
  height: number; // visible viewport height in px while open
}

const KEYBOARD_MIN_PX = 120; // smaller changes are browser toolbars, not a keyboard
const MOBILE_QUERY = "(max-width: 820px) and (pointer: coarse)";

export function useEditorKeyboard(rootRef: RefObject<HTMLElement | null>): EditorKeyboardState {
  const [state, setState] = useState<EditorKeyboardState>({ open: false, height: 0 });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const mobile = window.matchMedia(MOBILE_QUERY);

    // Height of the page without a keyboard. Some browsers shrink innerHeight
    // with the keyboard, others only the visual viewport, so keep the largest
    // value seen and reset it when the width changes (rotation).
    let baseline = window.innerHeight;
    let baseWidth = window.innerWidth;
    let raf = 0;
    let wasOpen = false;

    const measure = () => {
      if (window.innerWidth !== baseWidth) {
        baseWidth = window.innerWidth;
        baseline = window.innerHeight;
      }
      baseline = Math.max(baseline, window.innerHeight);

      const editor = rootRef.current?.querySelector<HTMLElement>(".ide-editor .cm-editor");
      const active = document.activeElement;
      const inEditor = !!editor && !!active && editor.contains(active);
      const keyboard = baseline - vv.height > KEYBOARD_MIN_PX;
      const open = mobile.matches && inEditor && keyboard;
      const height = Math.round(vv.height);

      setState((prev) =>
        prev.open === open && (!open || prev.height === height) ? prev : { open, height }
      );

      if (open) {
        // iOS pans the page to reveal the caret; the IDE now fits the visible
        // area, so pin it to the top instead.
        if (window.scrollY !== 0) window.scrollTo(0, 0);
        if (!wasOpen && editor) {
          // After the layout change, bring the caret back into view.
          requestAnimationFrame(() => {
            const view = EditorView.findFromDOM(editor);
            if (view) view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: "nearest", yMargin: 24 }) });
          });
        }
      }
      wasOpen = open;
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
    };
  }, [rootRef]);

  return state;
}
