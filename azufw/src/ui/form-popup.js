'use strict';

const blessed = require('neo-blessed');

const FIELDS = ['action', 'port', 'protocol', 'from', 'to', 'comment'];

function showFormPopup(screen, rule, onSave, onCancel) {
  const isEdit = rule && rule.number > 0;
  const mode = isEdit ? 'edit' : 'add';

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

  const formInputs = {};
  let currentFieldIndex = 0;
  const cursorPositions = {};
  FIELDS.forEach(k => { cursorPositions[k] = 0; });

  const fields = [
    { key: 'action', label: 'Action', type: 'choice', choices: ['ALLOW', 'DENY', 'REJECT'], value: rule ? rule.action : 'ALLOW' },
    { key: 'port', label: 'Port', type: 'input', value: rule ? rule.port : '' },
    { key: 'protocol', label: 'Protocol', type: 'choice', choices: ['tcp', 'udp'], value: rule ? rule.protocol : 'tcp' },
    { key: 'from', label: 'From IP', type: 'input', value: rule ? rule.from : 'any' },
    { key: 'to', label: 'To IP', type: 'input', value: rule ? rule.to : 'any' },
    { key: 'comment', label: 'Comment', type: 'input', value: rule ? rule.comment : '' },
  ];

  function updateInputDisplay(widget, fieldKey) {
    const val = widget.getValue();
    const pos = cursorPositions[fieldKey];
    const left = val.slice(0, pos);
    const cursor = pos < val.length ? val[pos] : ' ';
    const right = val.slice(pos + 1);
    const display = left + '{white-bg}{black-fg}' + cursor + '{/black-fg}{/white-bg}' + right;
    widget.setContent(display);
  }

  fields.forEach((field, idx) => {
    const yPos = 4 + idx;

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

  function highlightField(index) {
    currentFieldIndex = index;
    FIELDS.forEach((key, i) => {
      const widget = formInputs[key];
      if (!widget) return;
      widget.style.bg = i === index ? '#2471a3' : '#2c3e50';
    });
  }

  function focusCurrentField() {
    const key = FIELDS[currentFieldIndex];
    const widget = formInputs[key];
    if (widget && widget.focus) {
      widget.focus();
    }
  }

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

  function cycleChoice() {
    const key = FIELDS[currentFieldIndex];
    const widget = formInputs[key];
    if (!widget || !widget._choices) return;
    widget._currentChoice = (widget._currentChoice + 1) % widget._choices.length;
    const val = widget._choices[widget._currentChoice];
    widget.setContent(` [${widget._currentChoice + 1}/${widget._choices.length}] ${val} `);
  }

  function cycleChoiceBack() {
    const key = FIELDS[currentFieldIndex];
    const widget = formInputs[key];
    if (!widget || !widget._choices) return;
    widget._currentChoice = (widget._currentChoice - 1 + widget._choices.length) % widget._choices.length;
    const val = widget._choices[widget._currentChoice];
    widget.setContent(` [${widget._currentChoice + 1}/${widget._choices.length}] ${val} `);
  }

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

  const popup = {
    overlay,
    mode,
    rule,
    formInputs,
    active: true,

    dismiss() {
      this.active = false;
      endCurrentFieldRead();
      this.overlay.hide();
      const idx = screen.children.indexOf(this.overlay);
      if (idx !== -1) screen.children.splice(idx, 1);
      this.overlay.destroy();
      screen.render();
    },

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
