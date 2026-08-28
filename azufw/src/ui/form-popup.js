'use strict';

/**
 * ============================================================================
 * FORM POPUP  —  the Add/Edit rule dialog
 * ----------------------------------------------------------------------------
 * Rendered when the user presses A (Add) or Enter (Edit) on a rule.
 *
 * The form has TWO kinds of fields, both classified by their `_choices` property:
 *
 *   • Choice fields (Action, Protocol)  — displayed as `[n/N] value` and
 *     cycled with Space / Left / Right.
 *   • Text fields (Port, From, To, Comment) — plain text that supports
 *     left/right/home/end cursor movement. The cursor is simulated visually by
 *     splitin the string and wrapping the character at the cursor position in a
 *     white-on-black tag (see updateInputDisplay below).
 *
 * IMPORTANT quirk handled here:
 *   neo-blessed textboxes try to intercept ALL keystrokes for editing. Since we
 *   implement our own cursor simulation, we must STRIP the widget's built-in
 *   keypress listener (in setupTextareaInput) by scheduling it for the next tick
 *   and replacing it with a no-op BEFORE any user input can land — otherwise the
 *   widget would both edit itself AND we'd edit, producing double characters.
 *
 * All keystrokes flow through `handleKey()`, which returns true when consumed
 * (so callers know not to reprocess the event).
 * ============================================================================
 */

const blessed = require('neo-blessed');

/**
 * Order (and hence tab order) of all form fields.
 * Mirrors the order of the `fields` array below and the label rows.
 * @type {string[]}
 */
const FIELDS = ['action', 'port', 'protocol', 'from', 'to', 'comment'];

/**
 * Opens the Add/Edit form popup centered on the screen.
 *
 * @param {object} screen   - the blessed screen
 * @param {Rule|null} rule  - an EXISTING rule (Edit mode) or null (Add mode).
 *                           Preset-driven Adds pass a Rule with number 0 so they
 *                           behave identically to full Adds.
 * @param {function(values: object, existingRule: Rule|null)} onSave - called when
 *                           Ctrl+S fires. `existingRule` matches the `rule`
 *                           argument (null for pure Adds).
 * @param {function()}        onCancel - called when Esc is pressed.
 * @returns {object} popup object ({handleKey, dismiss, active})
 */
function showFormPopup(screen, rule, onSave, onCancel) {
  // number>0 ⟺ the rule already exists in UFW → Edit, otherwise Add.
  const isEdit = rule && rule.number > 0;
  const mode = isEdit ? 'edit' : 'add';

  // --- Frame ---------------------------------------------------------------
  const overlay = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '45%',
    height: 17,
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: '#5dade2' },
      bg: '#0d1b2a',
    },
  });

  // Title bar shows a different label per mode.
  const title = isEdit
    ? `{bold}{cyan-fg}Edit Rule #${rule.number}{/cyan-fg}{/bold}`
    : `{bold}{green-fg}Add New Rule{/green-fg}{/bold}`;

  blessed.box({
    parent: overlay,
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    content: title,
    tags: true,
    align: 'center',
    valign: 'middle',
    style: { bg: '#1a5276' },
  });

  // Widgets for each field, indexed by FIELDS name.
  const formInputs = {};

  // Cursor position (character index) for each TEXT field.
  const cursorPositions = {};
  FIELDS.forEach(k => { cursorPositions[k] = 0; });

  /**
   * Field descriptor list. `value` seeds the initial content.
   * Choice fields list their allowed options.
   */
  const fields = [
    { key: 'action', label: 'Action', type: 'choice', choices: ['ALLOW', 'DENY', 'REJECT'], value: rule ? rule.action : 'ALLOW' },
    { key: 'port', label: 'Port', type: 'input', value: rule ? rule.port : '' },
    { key: 'protocol', label: 'Protocol', type: 'choice', choices: ['tcp', 'udp'], value: rule ? rule.protocol : 'tcp' },
    { key: 'from', label: 'From IP', type: 'input', value: rule ? rule.from : 'any' },
    { key: 'to', label: 'To IP', type: 'input', value: rule ? rule.to : 'any' },
    { key: 'comment', label: 'Comment', type: 'input', value: rule ? rule.comment : '' },
  ];

  /**
   * Redraws a text widget with a simulated visible cursor inline.
   * The widget itself doesn't render textbox cursors in boxes reliably, so we
   * build a tagged string where the cursor cell is highlighted with reverse video.
   * @param {object} widget   - the blessed widget being rendered
   * @param {string} fieldKey  - FIELDS key used to index cursorPositions
   */
  function updateInputDisplay(widget, fieldKey) {
    const val = widget.getValue();
    const pos = cursorPositions[fieldKey];
    const left = val.slice(0, pos);
    const cursor = pos < val.length ? val[pos] : ' ';
    const right = val.slice(pos + 1);
    const display = left + '{white-bg}{black-fg}' + cursor + '{/black-fg}{/white-bg}' + right;
    widget.setContent(display);
  }

  /**
   * Creates one visible row (label + widget) per field.
   */
  fields.forEach((field, idx) => {
    const yPos = 4 + idx;

    // Gray label column
    blessed.text({
      parent: overlay,
      top: yPos,
      left: 1,
      width: 12,
      content: `  ${field.label}:`,
      tags: true,
      style: { fg: '#d5d8dc' },
    });

    if (field.type === 'choice') {
      // Choice widget is just an inert box whose content we rewrite on cycling.
      // Marks itself with `_choices` so the handler code knows → isChoice.
      const choiceBox = blessed.box({
        parent: overlay,
        top: yPos,
        left: 13,
        right: 1,
        height: 1,
        content: ` [${field.choices.indexOf(field.value) + 1}/${field.choices.length}] ${field.value} `,
        tags: true,
        style: {
          bg: idx === 0 ? '#2471a3' : '#2c3e50',
          fg: '#ffffff',
        },
      });
      choiceBox._choices = field.choices;
      choiceBox._currentChoice = field.choices.indexOf(field.value);
      formInputs[field.key] = choiceBox;
    } else {
      // Text widget: a textbox (value-aware), but we take over all editing
      // ourselves. `_choices === undefined` marks it as a text field.
      const input = blessed.textbox({
        parent: overlay,
        top: yPos,
        left: 13,
        right: 1,
        height: 1,
        inputOnFocus: true,
        tags: true,
        value: field.value || '',
        style: {
          bg: idx === 0 ? '#2471a3' : '#2c3e50',
          fg: '#ffffff',
          focus: { bg: '#2471a3' },
        },
      });
      cursorPositions[field.key] = (field.value || '').length;
      formInputs[field.key] = input;
    }
  });

  // --- Static footer hints -----------------------------------------------------
  blessed.box({
    parent: overlay,
    bottom: 2,
    left: 1,
    right: 1,
    height: 1,
    content: '{center}{gray-fg}─────────────────────────────────────────────{/gray-fg}{/center}',
    tags: true,
  });

  blessed.box({
    parent: overlay,
    bottom: 0,
    left: 1,
    right: 1,
    height: 2,
    content: '{center}{yellow-fg}Tab/↑↓:Field  ←→/Space:Choice  Home/End:Jump  Backspace/Del:Delete{/gray-fg}\n{center}{yellow-fg}Ctrl+S:Save  Esc:Cancel{/yellow-fg}{/center}',
    tags: true,
  });

  // --- Editing helpers (operate on the CURRENTLY focused field) ---------------

  /** Moves the highlight background onto field[`index`]. */
  function highlightField(index) {
    currentFieldIndex = index;
    FIELDS.forEach((key, i) => {
      const widget = formInputs[key];
      if (!widget) return;
      widget.style.bg = i === index ? '#2471a3' : '#2c3e50';
    });
  }

  /** Focuses the current field / widget. */
  function focusCurrentField() {
    const key = FIELDS[currentFieldIndex];
    const widget = formInputs[key];
    if (widget && widget.focus) {
      widget.focus();
    }
  }

  /**
   * Neo-blessed textboxes enter a "reading" phase (they capture keys internally).
   * When we leave a text field we must end that phase, otherwise Tab/Esc/etc. get
   * swallowed. The exact contract is: if the widget has `_done`, call it('stop'),
   * and always un-grabKeys from the screen.
   */
  function endCurrentFieldRead() {
    const key = FIELDS[currentFieldIndex];
    const widget = formInputs[key];
    if (widget && !widget._choices && widget._reading && typeof widget._done === 'function') {
      try {
        widget._done('stop');
      } catch (_e) {
        widget._reading = false;
      }
    }
    if (screen.grabKeys) {
      screen.grabKeys = false;
    }
  }

  /**
   * Collects the current values from all widgets into `{ key: value }`.
   */
  function getFormValues() {
    const values = {};
    for (const key of FIELDS) {
      const widget = formInputs[key];
      if (!widget) continue;
      if (widget._choices) {
        values[key] = widget._choices[widget._currentChoice];
      } else {
        values[key] = (widget.getValue ? widget.getValue() : widget.content || '').trim();
      }
    }
    return values;
  }

  // --- Character-level editing primitives ---------------------------------------

  /** Cycles a choice field FORWARD (next choice). */
  function cycleChoice() {
    const key = FIELDS[currentFieldIndex];
    const widget = formInputs[key];
    if (!widget || !widget._choices) return;
    widget._currentChoice = (widget._currentChoice + 1) % widget._choices.length;
    const val = widget._choices[widget._currentChoice];
    widget.setContent(` [${widget._currentChoice + 1}/${widget._choices.length}] ${val} `);
  }

  /** Cycles a choice field BACKWARD (previous choice). */
  function cycleChoiceBack() {
    const key = FIELDS[currentFieldIndex];
    const widget = formInputs[key];
    if (!widget || !widget._choices) return;
    widget._currentChoice = (widget._currentChoice - 1 + widget._choices.length) % widget._choices.length;
    const val = widget._choices[widget._currentChoice];
    widget.setContent(` [${widget._currentChoice + 1}/${widget._choices.length}] ${val} `);
  }

  /** Inserts a character at the cursor in the current text field. */
  function insertChar(ch) {
    const fkey = FIELDS[currentFieldIndex];
    const widget = formInputs[fkey];
    if (!widget || widget._choices) return;
    const pos = cursorPositions[fkey];
    const val = widget.getValue();
    const newVal = val.slice(0, pos) + ch + val.slice(pos);
    widget.setValue(newVal);
    widget._value = newVal;
    cursorPositions[fkey] = pos + ch.length;
    updateInputDisplay(widget, fkey);
    screen.render();
  }

  /** Deletes the character BEFORE the cursor ( ← Backspace ). */
  function deleteCharBack() {
    const fkey = FIELDS[currentFieldIndex];
    const widget = formInputs[fkey];
    if (!widget || widget._choices) return;
    const pos = cursorPositions[fkey];
    if (pos <= 0) return;
    const val = widget.getValue();
    const newVal = val.slice(0, pos - 1) + val.slice(pos);
    widget.setValue(newVal);
    widget._value = newVal;
    cursorPositions[fkey] = pos - 1;
    updateInputDisplay(widget, fkey);
    screen.render();
  }

  /** Deletes the character AT the cursor ( Del / Delete ). */
  function deleteCharForward() {
    const fkey = FIELDS[currentFieldIndex];
    const widget = formInputs[fkey];
    if (!widget || widget._choices) return;
    const pos = cursorPositions[fkey];
    const val = widget.getValue();
    if (pos >= val.length) return;
    const newVal = val.slice(0, pos) + val.slice(pos + 1);
    widget.setValue(newVal);
    widget._value = newVal;
    updateInputDisplay(widget, fkey);
    screen.render();
  }

  /** Moves the simulated cursor LEFT in the current text field. */
  function moveCursorLeft() {
    const fkey = FIELDS[currentFieldIndex];
    const widget = formInputs[fkey];
    if (!widget || widget._choices) return;
    if (cursorPositions[fkey] > 0) {
      cursorPositions[fkey]--;
      updateInputDisplay(widget, fkey);
      screen.render();
    }
  }

  /** Moves the simulated cursor RIGHT in the current text field. */
  function moveCursorRight() {
    const fkey = FIELDS[currentFieldIndex];
    const widget = formInputs[fkey];
    if (!widget || widget._choices) return;
    const val = widget.getValue();
    if (cursorPositions[fkey] < val.length) {
      cursorPositions[fkey]++;
      updateInputDisplay(widget, fkey);
      screen.render();
    }
  }

  /** Jumps the cursor to the START of the current text field. */
  function moveCursorHome() {
    const fkey = FIELDS[currentFieldIndex];
    const widget = formInputs[fkey];
    if (!widget || widget._choices) return;
    if (cursorPositions[fkey] !== 0) {
      cursorPositions[fkey] = 0;
      updateInputDisplay(widget, fkey);
      screen.render();
    }
  }

  /** Jumps the cursor to the END of the current text field. */
  function moveCursorEnd() {
    const fkey = FIELDS[currentFieldIndex];
    const widget = formInputs[fkey];
    if (!widget || widget._choices) return;
    const val = widget.getValue();
    if (cursorPositions[fkey] !== val.length) {
      cursorPositions[fkey] = val.length;
      updateInputDisplay(widget, fkey);
      screen.render();
    }
  }

  /**
   * NEUTRALIZES the built-in textbox editing on a widget.
   * See the header comment for the full explanation. We schedule this for the next
   * tick, because neo-blessed installs its real listener during focus() (which
   * happens in the tick that calls this). After that we swap it for a no-op.
   * The switch must happen once; `__listener` guards the double-run.
   */
  function setupTextareaInput(widget, fieldKey) {
    process.nextTick(() => {
      if (!widget.__listener) return;
      widget.removeListener('keypress', widget.__listener);

      widget.__listener = function() {};

      widget.on('keypress', widget.__listener);
      cursorPositions[fieldKey] = (widget.getValue() || '').length;
      updateInputDisplay(widget, fieldKey);
      screen.render();
    });
  }

  // --- Field navigation ------------------------------------------------------

  /** Tab / Down: move focus to the field AFTER the current one (wraps). */
  function tabField() {
    endCurrentFieldRead();
    currentFieldIndex = (currentFieldIndex + 1) % FIELDS.length;
    highlightField(currentFieldIndex);
    focusCurrentField();
    const key = FIELDS[currentFieldIndex];
    if (formInputs[key] && !formInputs[key]._choices) {
      setupTextareaInput(formInputs[key], key);
    }
    screen.render();
  }

  /** Shift+Tab / Up: move focus to the field BEFORE the current one (wraps). */
  function tabFieldBack() {
    endCurrentFieldRead();
    currentFieldIndex = (currentFieldIndex - 1 + FIELDS.length) % FIELDS.length;
    highlightField(currentFieldIndex);
    focusCurrentField();
    const key = FIELDS[currentFieldIndex];
    if (formInputs[key] && !formInputs[key]._choices) {
      setupTextareaInput(formInputs[key], key);
    }
    screen.render();
  }

  highlightField(0);
  focusCurrentField();
  const firstKey = FIELDS[currentFieldIndex];
  if (formInputs[firstKey] && !formInputs[firstKey]._choices) {
    setupTextareaInput(formInputs[firstKey], firstKey);
  }
  screen.render();

  // --- Public popup object returned to the caller -------------------------------

  const popup = {
    overlay,
    mode,
    rule,
    formInputs,
    active: true,

    /**
     * Closes the popup without saving; ends the textediting phase.
     */
    dismiss() {
      this.active = false;
      endCurrentFieldRead();
      this.overlay.hide();
      const idx = screen.children.indexOf(this.overlay);
      if (idx !== -1) screen.children.splice(idx, 1);
      this.overlay.destroy();
      screen.render();
    },

    /**
     * Keyboard dispatcher. src/index.js forwards every screen keypress here while
     * `active` is true.
     * @param {string|null} ch  - the typed character (single-char allows frame)
     * @param {object|null} key  - blessed key object (name, ctrl, shift, ...)
     * @returns {boolean} true if the key was consumed (do NOT reprocess lower)
     */
    handleKey(ch, key) {
      if (!this.active || !key) return false;

      const fkey = FIELDS[currentFieldIndex];
      const widget = formInputs[fkey];
      const isChoice = widget && widget._choices;
      const isInput = widget && !widget._choices;

      if (key.name === 'tab') {
        tabField();
        return true;
      }
      if (key.name === 'S-tab' || (key.name === 'tab' && key.shift)) {
        tabFieldBack();
        return true;
      }
      if (key.name === 'up') {
        tabFieldBack();
        return true;
      }
      if (key.name === 'down') {
        tabField();
        return true;
      }
      if (key.name === 'left') {
        if (isChoice) {
          cycleChoiceBack();
          screen.render();
        } else if (isInput) {
          moveCursorLeft();
        }
        return true;
      }
      if (key.name === 'right') {
        if (isChoice) {
          cycleChoice();
          screen.render();
        } else if (isInput) {
          moveCursorRight();
        }
        return true;
      }
      if (key.name === 'home') {
        if (isInput) {
          moveCursorHome();
        }
        return true;
      }
      if (key.name === 'end') {
        if (isInput) {
          moveCursorEnd();
        }
        return true;
      }
      if (key.name === 'backspace') {
        if (isInput) {
          deleteCharBack();
        }
        return true;
      }
      if (key.name === 'delete') {
        if (isInput) {
          deleteCharForward();
        }
        return true;
      }
      if (key.name === 'space') {
        if (isChoice) {
          cycleChoice();
          screen.render();
        } else if (isInput) {
          insertChar(' ');
        }
        return true;
      }
      if (key.ctrl && key.name === 's') {
        // Save — require at least a port or an IP so we don't save an empty rule.
        const values = getFormValues();
        if (!values.port && !values.from) return true;
        this.dismiss();
        onSave(values, this.rule);
        return true;
      }
      if (key.name === 'escape') {
        this.dismiss();
        onCancel();
        return true;
      }
      // Fallback: plain printable character lands in a text field.
      if (ch && !isChoice && isInput && !/^[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]$/.test(ch)) {
        insertChar(ch);
        return true;
      }
      return false;
    },
  };

  return popup;
}

module.exports = { showFormPopup };
