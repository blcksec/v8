'use strict';

const {
  ObjectDefineProperties,
  ObjectSetPrototypeOf,
  SafeMap,
  SafeSet,
  SafeArrayIterator,
  Symbol,
  SymbolToStringTag,
  ReflectConstruct,
} = primordials;

const { initPerformanceEntry, PerformanceEntry } = require('internal/perf/performance_entry');
const { now } = require('internal/perf/utils');
const { enqueue, bufferUserTiming } = require('internal/perf/observe');
const nodeTiming = require('internal/perf/nodetiming');

const {
  validateNumber,
  validateObject,
  validateString,
  validateInternalField,
} = require('internal/validators');

const {
  codes: {
    ERR_ILLEGAL_CONSTRUCTOR,
    ERR_INVALID_ARG_VALUE,
    ERR_MISSING_ARGS,
    ERR_PERFORMANCE_INVALID_TIMESTAMP,
    ERR_PERFORMANCE_MEASURE_INVALID_OPTIONS,
  },
} = require('internal/errors');

const { structuredClone } = require('internal/structured_clone');
const {
  kEmptyObject,
  lazyDOMException,
  kEnumerableProperty,
} = require('internal/util');

const kDetail = Symbol('kDetail');

const markTimings = new SafeMap();

const nodeTimingReadOnlyAttributes = new SafeSet(new SafeArrayIterator([
  'nodeStart',
  'v8Start',
  'environment',
  'loopStart',
  'loopExit',
  'bootstrapComplete',
]));

function getMark(name) {
  if (name === undefined) return;
  if (typeof name === 'number') {
    if (name < 0)
      throw new ERR_PERFORMANCE_INVALID_TIMESTAMP(name);
    return name;
  }
  name = `${name}`;
  if (nodeTimingReadOnlyAttributes.has(name))
    return nodeTiming[name];
  const ts = markTimings.get(name);
  if (ts === undefined)
    throw lazyDOMException(`The "${name}" performance mark has not been set`, 'SyntaxError');
  return ts;
}

class PerformanceMark {
  constructor(name, options = kEmptyObject) {
    if (arguments.length === 0) {
      throw new ERR_MISSING_ARGS('name');
    }
    name = `${name}`;
    options ??= kEmptyObject;
    if (nodeTimingReadOnlyAttributes.has(name))
      throw new ERR_INVALID_ARG_VALUE('name', name);
    validateObject(options, 'options');
    const startTime = options.startTime ?? now();
    validateNumber(startTime, 'startTime');
    if (startTime < 0)
      throw new ERR_PERFORMANCE_INVALID_TIMESTAMP(startTime);
    markTimings.set(name, startTime);

    let detail = options.detail;
    detail = detail != null ?
      structuredClone(detail) :
      null;
    initPerformanceEntry(this, name, 'mark', startTime, 0);
    this[kDetail] = detail;
  }

  get detail() {
    validateInternalField(this, kDetail, 'PerformanceMark');
    return this[kDetail];
  }

  get [SymbolToStringTag]() {
    return 'PerformanceMark';
  }

  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this[kDetail],
    };
  }
}
ObjectSetPrototypeOf(PerformanceMark, PerformanceEntry);
ObjectSetPrototypeOf(PerformanceMark.prototype, PerformanceEntry.prototype);
ObjectDefineProperties(PerformanceMark.prototype, {
  detail: kEnumerableProperty,
});

class PerformanceMeasure extends PerformanceEntry {
  constructor() {
    throw new ERR_ILLEGAL_CONSTRUCTOR();
  }

  get detail() {
    validateInternalField(this, kDetail, 'PerformanceMeasure');
    return this[kDetail];
  }

  get [SymbolToStringTag]() {
    return 'PerformanceMeasure';
  }
}
ObjectDefineProperties(PerformanceMeasure.prototype, {
  detail: kEnumerableProperty,
});

function createPerformanceMeasure(name, start, duration, detail) {
  return ReflectConstruct(function PerformanceMeasure() {
    initPerformanceEntry(this, name, 'measure', start, duration);
    this[kDetail] = detail;
  }, [], PerformanceMeasure);
}

function mark(name, options) {
  const mark = new PerformanceMark(name, options);
  enqueue(mark);
  bufferUserTiming(mark);
  return mark;
}

function calculateStartDuration(startOrMeasureOptions, endMark) {
  startOrMeasureOptions ??= 0;
  let start;
  let end;
  let duration;
  let optionsValid = false;
  if (typeof startOrMeasureOptions === 'object') {
    ({ start, end, duration } = startOrMeasureOptions);
    optionsValid = start !== undefined || end !== undefined;
  }
  if (optionsValid) {
    if (endMark !== undefined) {
      throw new ERR_PERFORMANCE_MEASURE_INVALID_OPTIONS(
        'endMark must not be specified');
    }

    if (start === undefined && end === undefined) {
      throw new ERR_PERFORMANCE_MEASURE_INVALID_OPTIONS(
        'One of options.start or options.end is required');
    }
    if (start !== undefined && end !== undefined && duration !== undefined) {
      throw new ERR_PERFORMANCE_MEASURE_INVALID_OPTIONS(
        'Must not have options.start, options.end, and ' +
        'options.duration specified');
    }
  }

  if (endMark !== undefined) {
    end = getMark(endMark);
  } else if (optionsValid && end !== undefined) {
    end = getMark(end);
  } else if (optionsValid && start !== undefined && duration !== undefined) {
    end = getMark(start) + getMark(duration);
  } else {
    end = now();
  }

  if (typeof startOrMeasureOptions === 'string') {
    start = getMark(startOrMeasureOptions);
  } else if (optionsValid && start !== undefined) {
    start = getMark(start);
  } else if (optionsValid && duration !== undefined && end !== undefined) {
    start = end - getMark(duration);
  } else {
    start = 0;
  }

  duration = end - start;
  return { start, duration };
}

function measure(name, startOrMeasureOptions, endMark) {
  validateString(name, 'name');
  const {
    start,
    duration,
  } = calculateStartDuration(startOrMeasureOptions, endMark);
  let detail = startOrMeasureOptions?.detail;
  detail = detail != null ? structuredClone(detail) : null;
  const measure = createPerformanceMeasure(name, start, duration, detail);
  enqueue(measure);
  bufferUserTiming(measure);
  return measure;
}

function clearMarkTimings(name) {
  if (name !== undefined) {
    name = `${name}`;
    if (nodeTimingReadOnlyAttributes.has(name))
      throw new ERR_INVALID_ARG_VALUE('name', name);
    markTimings.delete(name);
    return;
  }
  markTimings.clear();
}

module.exports = {
  PerformanceMark,
  PerformanceMeasure,
  clearMarkTimings,
  mark,
  measure,
};
