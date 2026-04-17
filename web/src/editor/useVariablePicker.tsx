import { useState, useCallback, useRef, KeyboardEvent, ChangeEvent } from 'react';

export interface VariablePickerState {
  isOpen: boolean;
  position: { x: number; y: number } | undefined;
  filter: string;
  cursorPosition: number;
}

export function useVariablePicker() {
  const [pickerState, setPickerState] = useState<VariablePickerState>({
    isOpen: false,
    position: undefined,
    filter: '',
    cursorPosition: 0,
  });
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const cursorPos = target.selectionStart || 0;
    const value = target.value;

    // Check if @ was typed
    if (e.key === '@' && !pickerState.isOpen) {
      e.preventDefault();

      // Get cursor position on screen
      const rect = target.getBoundingClientRect();
      const position = {
        x: rect.left + 10,
        y: rect.bottom + 5,
      };

      // Insert @ and open picker
      const newValue = value.slice(0, cursorPos) + '@' + value.slice(cursorPos);
      target.value = newValue;
      target.setSelectionRange(cursorPos + 1, cursorPos + 1);

      setPickerState({
        isOpen: true,
        position,
        filter: '',
        cursorPosition: cursorPos + 1,
      });

      // Trigger onChange manually since we prevented default
      const event = new Event('input', { bubbles: true });
      target.dispatchEvent(event);
    }

    // Close picker on Escape
    if (e.key === 'Escape' && pickerState.isOpen) {
      e.preventDefault();
      setPickerState(prev => ({ ...prev, isOpen: false }));
    }
  }, [pickerState.isOpen]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!pickerState.isOpen) return;

    const target = e.currentTarget;
    const cursorPos = target.selectionStart || 0;
    const value = target.value;

    // Find the @ symbol before cursor
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) {
      // @ was deleted, close picker
      setPickerState(prev => ({ ...prev, isOpen: false }));
      return;
    }

    // Extract filter text after @
    const filterText = textBeforeCursor.slice(lastAtIndex + 1);

    // Close picker if space or special chars are typed (except . for namespaces)
    if (/[\s,;(){}[\]]/.test(filterText)) {
      setPickerState(prev => ({ ...prev, isOpen: false }));
      return;
    }

    setPickerState(prev => ({
      ...prev,
      filter: filterText,
      cursorPosition: lastAtIndex,
    }));
  }, [pickerState.isOpen]);

  const handleSelect = useCallback((variable: string) => {
    if (!inputRef.current) return;

    const target = inputRef.current;
    const value = target.value;
    const { cursorPosition } = pickerState;

    // Find the @ symbol and replace @filter with {{variable}}
    const textBeforeCursor = value.slice(0, target.selectionStart || 0);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const beforeAt = value.slice(0, lastAtIndex);
      const afterCursor = value.slice(target.selectionStart || 0);
      const newValue = beforeAt + variable + afterCursor;

      target.value = newValue;
      const newCursorPos = beforeAt.length + variable.length;
      target.setSelectionRange(newCursorPos, newCursorPos);

      // Trigger onChange
      const event = new Event('input', { bubbles: true });
      target.dispatchEvent(event);
    }

    setPickerState({
      isOpen: false,
      position: undefined,
      filter: '',
      cursorPosition: 0,
    });

    target.focus();
  }, [pickerState]);

  const handleClose = useCallback(() => {
    setPickerState({
      isOpen: false,
      position: undefined,
      filter: '',
      cursorPosition: 0,
    });
  }, []);

  const registerInput = useCallback((element: HTMLInputElement | HTMLTextAreaElement | null) => {
    inputRef.current = element;
  }, []);

  return {
    pickerState,
    handleKeyDown,
    handleChange,
    handleSelect,
    handleClose,
    registerInput,
  };
}
