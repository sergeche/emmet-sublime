//     Underscore.js 1.3.3
//     (c) 2009-2012 Jeremy Ashkenas, DocumentCloud Inc.
//     Underscore is freely distributable under the MIT license.
//     Portions of Underscore are inspired or borrowed from Prototype,
//     Oliver Steele's Functional, and John Resig's Micro-Templating.
//     For all details and documentation:
//     http://documentcloud.github.com/underscore

var _ = (function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `global` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var slice            = ArrayProto.slice,
      unshift          = ArrayProto.unshift,
      toString         = ObjProto.toString,
      hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) { return new wrapper(obj); };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root['_'] = _;
  }

  // Current version.
  _.VERSION = '1.3.3';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, l = obj.length; i < l; i++) {
        if (i in obj && iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      for (var key in obj) {
        if (_.has(obj, key)) {
          if (iterator.call(context, obj[key], key, obj) === breaker) return;
        }
      }
    }
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results[results.length] = iterator.call(context, value, index, list);
    });
    if (obj.length === +obj.length) results.length = obj.length;
    return results;
  };

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError('Reduce of empty array with no initial value');
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var reversed = _.toArray(obj).reverse();
    if (context && !initial) iterator = _.bind(iterator, context);
    return initial ? _.reduce(reversed, iterator, memo, context) : _.reduce(reversed, iterator);
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, iterator, context) {
    var result;
    any(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    each(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) results[results.length] = value;
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    each(obj, function(value, index, list) {
      if (!iterator.call(context, value, index, list)) results[results.length] = value;
    });
    return results;
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, iterator, context) {
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    each(obj, function(value, index, list) {
      if (result || (result = iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if a given value is included in the array or object using `===`.
  // Aliased as `contains`.
  _.include = _.contains = function(obj, target) {
    var found = false;
    if (obj == null) return found;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    found = any(obj, function(value) {
      return value === target;
    });
    return found;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    return _.map(obj, function(value) {
      return (_.isFunction(method) ? method || value : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, function(value){ return value[key]; });
  };

  // Return the maximum element or (element-based computation).
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0]) return Math.max.apply(Math, obj);
    if (!iterator && _.isEmpty(obj)) return -Infinity;
    var result = {computed : -Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed >= result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0]) return Math.min.apply(Math, obj);
    if (!iterator && _.isEmpty(obj)) return Infinity;
    var result = {computed : Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Shuffle an array.
  _.shuffle = function(obj) {
    var shuffled = [], rand;
    each(obj, function(value, index, list) {
      rand = Math.floor(Math.random() * (index + 1));
      shuffled[index] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, val, context) {
    var iterator = _.isFunction(val) ? val : function(obj) { return obj[val]; };
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value : value,
        criteria : iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      if (a === void 0) return 1;
      if (b === void 0) return -1;
      return a < b ? -1 : a > b ? 1 : 0;
    }), 'value');
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = function(obj, val) {
    var result = {};
    var iterator = _.isFunction(val) ? val : function(obj) { return obj[val]; };
    each(obj, function(value, index) {
      var key = iterator(value, index);
      (result[key] || (result[key] = [])).push(value);
    });
    return result;
  };

  // Use a comparator function to figure out at what index an object should
  // be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator) {
    iterator || (iterator = _.identity);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >> 1;
      iterator(array[mid]) < iterator(obj) ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely convert anything iterable into a real, live array.
  _.toArray = function(obj) {
    if (!obj)                                     return [];
    if (_.isArray(obj))                           return slice.call(obj);
    if (_.isArguments(obj))                       return slice.call(obj);
    if (obj.toArray && _.isFunction(obj.toArray)) return obj.toArray();
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    return _.isArray(obj) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    return (n != null) && !guard ? slice.call(array, 0, n) : array[0];
  };

  // Returns everything but the last entry of the array. Especcialy useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if ((n != null) && !guard) {
      return slice.call(array, Math.max(array.length - n, 0));
    } else {
      return array[array.length - 1];
    }
  };

  // Returns everything but the first entry of the array. Aliased as `tail`.
  // Especially useful on the arguments object. Passing an **index** will return
  // the rest of the values in the array from that index onward. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = function(array, index, guard) {
    return slice.call(array, (index == null) || guard ? 1 : index);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, function(value){ return !!value; });
  };

  // Return a completely flattened version of an array.
  _.flatten = function(array, shallow) {
    return _.reduce(array, function(memo, value) {
      if (_.isArray(value)) return memo.concat(shallow ? value : _.flatten(value));
      memo[memo.length] = value;
      return memo;
    }, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator) {
    var initial = iterator ? _.map(array, iterator) : array;
    var results = [];
    // The `isSorted` flag is irrelevant if the array only contains two elements.
    if (array.length < 3) isSorted = true;
    _.reduce(initial, function (memo, value, index) {
      if (isSorted ? _.last(memo) !== value || !memo.length : !_.include(memo, value)) {
        memo.push(value);
        results.push(array[index]);
      }
      return memo;
    }, []);
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(_.flatten(arguments, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays. (Aliased as "intersect" for back-compat.)
  _.intersection = _.intersect = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.indexOf(other, item) >= 0;
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = _.flatten(slice.call(arguments, 1), true);
    return _.filter(array, function(value){ return !_.include(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var args = slice.call(arguments);
    var length = _.max(_.pluck(args, 'length'));
    var results = new Array(length);
    for (var i = 0; i < length; i++) results[i] = _.pluck(args, "" + i);
    return results;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i, l;
    if (isSorted) {
      i = _.sortedIndex(array, item);
      return array[i] === item ? i : -1;
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item);
    for (i = 0, l = array.length; i < l; i++) if (i in array && array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item) {
    if (array == null) return -1;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) return array.lastIndexOf(item);
    var i = array.length;
    while (i--) if (i in array && array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var len = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(len);

    while(idx < len) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Binding with arguments is also known as `curry`.
  // Delegates to **ECMAScript 5**'s native `Function.bind` if available.
  // We check for `func.bind` first, to fail fast when `func` is undefined.
  _.bind = function bind(func, context) {
    var bound, args;
    if (func.bind === nativeBind && nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      ctor.prototype = func.prototype;
      var self = new ctor;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (Object(result) === result) return result;
      return self;
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length == 0) funcs = _.functions(obj);
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time.
  _.throttle = function(func, wait) {
    var context, args, timeout, throttling, more, result;
    var whenDone = _.debounce(function(){ more = throttling = false; }, wait);
    return function() {
      context = this; args = arguments;
      var later = function() {
        timeout = null;
        if (more) func.apply(context, args);
        whenDone();
      };
      if (!timeout) timeout = setTimeout(later, wait);
      if (throttling) {
        more = true;
      } else {
        result = func.apply(context, args);
      }
      whenDone();
      throttling = true;
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      if (immediate && !timeout) func.apply(context, args);
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      return memo = func.apply(this, arguments);
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return function() {
      var args = [func].concat(slice.call(arguments, 0));
      return wrapper.apply(this, args);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    if (times <= 0) return func();
    return function() {
      if (--times < 1) { return func.apply(this, arguments); }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = nativeKeys || function(obj) {
    if (obj !== Object(obj)) throw new TypeError('Invalid object');
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys[keys.length] = key;
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    return _.map(obj, _.identity);
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      for (var prop in source) {
        obj[prop] = source[prop];
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var result = {};
    each(_.flatten(slice.call(arguments, 1)), function(key) {
      if (key in obj) result[key] = obj[key];
    });
    return result;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      for (var prop in source) {
        if (obj[prop] == null) obj[prop] = source[prop];
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function.
  function eq(a, b, stack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the Harmony `egal` proposal: http://wiki.ecmascript.org/doku.php?id=harmony:egal.
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a._chain) a = a._wrapped;
    if (b._chain) b = b._wrapped;
    // Invoke a custom `isEqual` method if one is provided.
    if (a.isEqual && _.isFunction(a.isEqual)) return a.isEqual(b);
    if (b.isEqual && _.isFunction(b.isEqual)) return b.isEqual(a);
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = stack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (stack[length] == a) return true;
    }
    // Add the first object to the stack of traversed objects.
    stack.push(a);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          // Ensure commutative equality for sparse arrays.
          if (!(result = size in a == size in b && eq(a[size], b[size], stack))) break;
        }
      }
    } else {
      // Objects with different constructors are not equivalent.
      if ('constructor' in a != 'constructor' in b || a.constructor != b.constructor) return false;
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], stack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    stack.pop();
    return result;
  }

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType == 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Is a given variable an arguments object?
  _.isArguments = function(obj) {
    return toString.call(obj) == '[object Arguments]';
  };
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Is a given value a function?
  _.isFunction = function(obj) {
    return toString.call(obj) == '[object Function]';
  };

  // Is a given value a string?
  _.isString = function(obj) {
    return toString.call(obj) == '[object String]';
  };

  // Is a given value a number?
  _.isNumber = function(obj) {
    return toString.call(obj) == '[object Number]';
  };

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return _.isNumber(obj) && isFinite(obj);
  };

  // Is the given value `NaN`?
  _.isNaN = function(obj) {
    // `NaN` is the only value for which `===` is not reflexive.
    return obj !== obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value a date?
  _.isDate = function(obj) {
    return toString.call(obj) == '[object Date]';
  };

  // Is the given value a regular expression?
  _.isRegExp = function(obj) {
    return toString.call(obj) == '[object RegExp]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Has own property?
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  // Run a function **n** times.
  _.times = function (n, iterator, context) {
    for (var i = 0; i < n; i++) iterator.call(context, i);
  };

  // Escape a string for HTML interpolation.
  _.escape = function(string) {
    return (''+string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g,'&#x2F;');
  };

  // If the value of the named property is a function then invoke it;
  // otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return null;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object, ensuring that
  // they're correctly added to the OOP wrapper as well.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name){
      addToWrapper(name, _[name] = obj[name]);
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = idCounter++;
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /.^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    '\\': '\\',
    "'": "'",
    'r': '\r',
    'n': '\n',
    't': '\t',
    'u2028': '\u2028',
    'u2029': '\u2029'
  };

  for (var p in escapes) escapes[escapes[p]] = p;
  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;
  var unescaper = /\\(\\|'|r|n|t|u2028|u2029)/g;

  // Within an interpolation, evaluation, or escaping, remove HTML escaping
  // that had been previously added.
  var unescape = function(code) {
    return code.replace(unescaper, function(match, escape) {
      return escapes[escape];
    });
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    settings = _.defaults(settings || {}, _.templateSettings);

    // Compile the template source, taking care to escape characters that
    // cannot be included in a string literal and then unescape them in code
    // blocks.
    var source = "__p+='" + text
      .replace(escaper, function(match) {
        return '\\' + escapes[match];
      })
      .replace(settings.escape || noMatch, function(match, code) {
        return "'+\n_.escape(" + unescape(code) + ")+\n'";
      })
      .replace(settings.interpolate || noMatch, function(match, code) {
        return "'+\n(" + unescape(code) + ")+\n'";
      })
      .replace(settings.evaluate || noMatch, function(match, code) {
        return "';\n" + unescape(code) + "\n;__p+='";
      }) + "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __p='';" +
      "var print=function(){__p+=Array.prototype.join.call(arguments, '')};\n" +
      source + "return __p;\n";

    var render = new Function(settings.variable || 'obj', '_', source);
    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for build time
    // precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' +
      source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // The OOP Wrapper
  // ---------------

  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.
  var wrapper = function(obj) { this._wrapped = obj; };

  // Expose `wrapper.prototype` as `_.prototype`
  _.prototype = wrapper.prototype;

  // Helper function to continue chaining intermediate results.
  var result = function(obj, chain) {
    return chain ? _(obj).chain() : obj;
  };

  // A method to easily add functions to the OOP wrapper.
  var addToWrapper = function(name, func) {
    wrapper.prototype[name] = function() {
      var args = slice.call(arguments);
      unshift.call(args, this._wrapped);
      return result(func.apply(_, args), this._chain);
    };
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    wrapper.prototype[name] = function() {
      var wrapped = this._wrapped;
      method.apply(wrapped, arguments);
      var length = wrapped.length;
      if ((name == 'shift' || name == 'splice') && length === 0) delete wrapped[0];
      return result(wrapped, this._chain);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    wrapper.prototype[name] = function() {
      return result(method.apply(this._wrapped, arguments), this._chain);
    };
  });

  // Start chaining a wrapped Underscore object.
  wrapper.prototype.chain = function() {
    this._chain = true;
    return this;
  };

  // Extracts the result from a wrapped and chained object.
  wrapper.prototype.value = function() {
    return this._wrapped;
  };
  return _;
}).call({});
/**
 * Core Emmet object, available in global scope
 */
var emmet = (function(global) {
	var defaultSyntax = 'html';
	var defaultProfile = 'plain';
	
	if (typeof _ == 'undefined') {
		try {
			// avoid collisions with RequireJS loader
			// also, JS obfuscators tends to translate
			// a["name"] to a.name, which also breaks RequireJS
			_ = global[['require'][0]]('underscore'); // node.js
		} catch (e) {}
	}

	if (typeof _ == 'undefined') {
		throw 'Cannot access to Underscore.js lib';
	}

	/** List of registered modules */
	var modules = {
		_ : _
	};
	
	/**
	 * Shared empty constructor function to aid in prototype-chain creation.
	 */
	var ctor = function(){};
	
	/**
	 * Helper function to correctly set up the prototype chain, for subclasses.
	 * Similar to `goog.inherits`, but uses a hash of prototype properties and
	 * class properties to be extended.
	 * Took it from Backbone.
	 * @param {Object} parent
	 * @param {Object} protoProps
	 * @param {Object} staticProps
	 * @returns {Object}
	 */
	function inherits(parent, protoProps, staticProps) {
		var child;

		// The constructor function for the new subclass is either defined by
		// you (the "constructor" property in your `extend` definition), or
		// defaulted by us to simply call the parent's constructor.
		if (protoProps && protoProps.hasOwnProperty('constructor')) {
			child = protoProps.constructor;
		} else {
			child = function() {
				parent.apply(this, arguments);
			};
		}

		// Inherit class (static) properties from parent.
		_.extend(child, parent);

		// Set the prototype chain to inherit from `parent`, without calling
		// `parent`'s constructor function.
		ctor.prototype = parent.prototype;
		child.prototype = new ctor();

		// Add prototype properties (instance properties) to the subclass,
		// if supplied.
		if (protoProps)
			_.extend(child.prototype, protoProps);

		// Add static properties to the constructor function, if supplied.
		if (staticProps)
			_.extend(child, staticProps);

		// Correctly set child's `prototype.constructor`.
		child.prototype.constructor = child;

		// Set a convenience property in case the parent's prototype is needed
		// later.
		child.__super__ = parent.prototype;

		return child;
	};
	
	/**
	 * @type Function Function that loads module definition if it's not defined
	 */
	var moduleLoader = null;
	
	/**
	 * Generic Emmet module loader (actually, it doesn’t load anything, just 
	 * returns module reference). Not using `require` name to avoid conflicts
	 * with Node.js and RequireJS
	 */
	function r(name) {
		if (!(name in modules) && moduleLoader)
			moduleLoader(name);
		
		return modules[name];
	}
	
	return {
		/**
		 * Simple, AMD-like module definition. The module will be added into
		 * <code>emmet</code> object and will be available via
		 * <code>emmet.require(name)</code> or <code>emmet[name]</code>
		 * @param {String} name
		 * @param {Function} factory
		 * @memberOf emmet
		 */
		define: function(name, factory) {
			// do not let redefine existing properties
			if (!(name in modules)) {
				modules[name] = _.isFunction(factory) 
					? this.exec(factory)
					: factory;
			}
		},
		
		/**
		 * Returns reference to Emmet module
		 * @param {String} name Module name
		 */
		require: r,
		
		/**
		 * Helper method that just executes passed function but with all 
		 * important arguments like 'require' and '_'
		 * @param {Function} fn
		 * @param {Object} context Execution context
		 */
		exec: function(fn, context) {
			return fn.call(context || global, _.bind(r, this), _, this);
		},
		
		/**
		 * The self-propagating extend function for classes.
		 * Took it from Backbone 
		 * @param {Object} protoProps
		 * @param {Object} classProps
		 * @returns {Object}
		 */
		extend: function(protoProps, classProps) {
			var child = inherits(this, protoProps, classProps);
			child.extend = this.extend;
			// a hack required to WSH inherit `toString` method
			if (protoProps.hasOwnProperty('toString'))
				child.prototype.toString = protoProps.toString;
			return child;
		},
		
		/**
		 * The essential function that expands Emmet abbreviation
		 * @param {String} abbr Abbreviation to parse
		 * @param {String} syntax Abbreviation's context syntax
		 * @param {String} profile Output profile (or its name)
		 * @param {Object} contextNode Contextual node where abbreviation is
		 * written
		 * @return {String}
		 */
		expandAbbreviation: function(abbr, syntax, profile, contextNode) {
			if (!abbr) return '';
			
			syntax = syntax || defaultSyntax;
//			profile = profile || defaultProfile;
			
			var filters = r('filters');
			var parser = r('abbreviationParser');
			
			profile = r('profile').get(profile, syntax);
			r('tabStops').resetTabstopIndex();
			
			var data = filters.extractFromAbbreviation(abbr);
			var outputTree = parser.parse(data[0], {
				syntax: syntax, 
				contextNode: contextNode
			});
			
			var filtersList = filters.composeList(syntax, profile, data[1]);
			filters.apply(outputTree, filtersList, profile);
			return outputTree.toString();
		},
		
		/**
		 * Returns default syntax name used in abbreviation engine
		 * @returns {String}
		 */
		defaultSyntax: function() {
			return defaultSyntax;
		},
		
		/**
		 * Returns default profile name used in abbreviation engine
		 * @returns {String}
		 */
		defaultProfile: function() {
			return defaultProfile;
		},
		
		/**
		 * Log message into console if it exists
		 */
		log: function() {
			if (global.console && global.console.log)
				global.console.log.apply(global.console, arguments);
		},
		
		/**
		 * Setups function that should synchronously load undefined modules
		 * @param {Function} fn
		 */
		setModuleLoader: function(fn) {
			moduleLoader = fn;
		}
	};
})(this);

// export core for Node.JS
if (typeof exports !== 'undefined') {
	if (typeof module !== 'undefined' && module.exports) {
		exports = module.exports = emmet;
	}
	exports.emmet = emmet;
}/**
 * Emmet abbreviation parser.
 * Takes string abbreviation and recursively parses it into a tree. The parsed 
 * tree can be transformed into a string representation with 
 * <code>toString()</code> method. Note that string representation is defined
 * by custom processors (called <i>filters</i>), not by abbreviation parser 
 * itself.
 * 
 * This module can be extended with custom pre-/post-processors to shape-up
 * final tree or its representation. Actually, many features of abbreviation 
 * engine are defined in other modules as tree processors
 * 
 * 
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * @memberOf __abbreviationParser
 * @constructor
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.define('abbreviationParser', function(require, _) {
	var reValidName = /^[\w\-\$\:@\!]+\+?$/i;
	var reWord = /[\w\-:\$]/;
	
	var pairs = {
		'[': ']',
		'(': ')',
		'{': '}'
	};
	
	var spliceFn = Array.prototype.splice;
	
	var preprocessors = [];
	var postprocessors = [];
	var outputProcessors = [];
	
	/**
	 * @type AbbreviationNode
	 */
	function AbbreviationNode(parent) {
		/** @type AbbreviationNode */
		this.parent = null;
		this.children = [];
		this._attributes = [];
		
		/** @type String Raw abbreviation for current node */
		this.abbreviation = '';
		this.counter = 1;
		this._name = null;
		this._text = '';
		this.repeatCount = 1;
		this.hasImplicitRepeat = false;
		
		/** Custom data dictionary */
		this._data = {};
		
		// output properties
		this.start = '';
		this.end = '';
		this.content = '';
		this.padding = '';
	}
	
	AbbreviationNode.prototype = {
		/**
		 * Adds passed node as child or creates new child
		 * @param {AbbreviationNode} child
		 * @param {Number} position Index in children array where child should 
		 * be inserted
		 * @return {AbbreviationNode}
		 */
		addChild: function(child, position) {
			child = child || new AbbreviationNode;
			child.parent = this;
			
			if (_.isUndefined(position)) {
				this.children.push(child);
			} else {
				this.children.splice(position, 0, child);
			}
			
			return child;
		},
		
		/**
		 * Creates a deep copy of current node
		 * @returns {AbbreviationNode}
		 */
		clone: function() {
			var node = new AbbreviationNode();
			var attrs = ['abbreviation', 'counter', '_name', '_text', 'repeatCount', 'hasImplicitRepeat', 'start', 'end', 'content', 'padding'];
			_.each(attrs, function(a) {
				node[a] = this[a];
			}, this);
			
			// clone attributes
			node._attributes = _.map(this._attributes, function(attr) {
				return _.clone(attr);
			});
			
			node._data = _.clone(this._data);
			
			// clone children
			node.children = _.map(this.children, function(child) {
				child = child.clone();
				child.parent = node;
				return child;
			});
			
			return node;
		},
		
		/**
		 * Removes current node from parent‘s child list
		 * @returns {AbbreviationNode} Current node itself
		 */
		remove: function() {
			if (this.parent) {
				this.parent.children = _.without(this.parent.children, this);
			}
			
			return this;
		},
		
		/**
		 * Replaces current node in parent‘s children list with passed nodes
		 * @param {AbbreviationNode} node Replacement node or array of nodes
		 */
		replace: function() {
			var parent = this.parent;
			var ix = _.indexOf(parent.children, this);
			var items = _.flatten(arguments);
			spliceFn.apply(parent.children, [ix, 1].concat(items));
			
			// update parent
			_.each(items, function(item) {
				item.parent = parent;
			});
		},
		
		/**
		 * Recursively sets <code>property</code> to <code>value</code> of current
		 * node and its children 
		 * @param {String} name Property to update
		 * @param {Object} value New property value
		 */
		updateProperty: function(name, value) {
			this[name] = value;
			_.each(this.children, function(child) {
				child.updateProperty(name, value);
			});
		},
		
		/**
		 * Finds first child node that matches truth test for passed 
		 * <code>fn</code> function
		 * @param {Function} fn
		 * @returns {AbbreviationNode}
		 */
		find: function(fn) {
			return this.findAll(fn)[0];
//			if (!_.isFunction(fn)) {
//				var elemName = fn.toLowerCase();
//				fn = function(item) {return item.name().toLowerCase() == elemName;};
//			}
//			
//			var result = null;
//			_.find(this.children, function(child) {
//				if (fn(child)) {
//					return result = child;
//				}
//				
//				return result = child.find(fn);
//			});
//			
//			return result;
		},
		
		/**
		 * Finds all child nodes that matches truth test for passed 
		 * <code>fn</code> function
		 * @param {Function} fn
		 * @returns {Array}
		 */
		findAll: function(fn) {
			if (!_.isFunction(fn)) {
				var elemName = fn.toLowerCase();
				fn = function(item) {return item.name().toLowerCase() == elemName;};
			}
				
			var result = [];
			_.each(this.children, function(child) {
				if (fn(child))
					result.push(child);
				
				result = result.concat(child.findAll(fn));
			});
			
			return _.compact(result);
		},
		
		/**
		 * Sets/gets custom data
		 * @param {String} name
		 * @param {Object} value
		 * @returns {Object}
		 */
		data: function(name, value) {
			if (arguments.length == 2) {
				this._data[name] = value;
				
				if (name == 'resource' && require('elements').is(value, 'snippet')) {
					// setting snippet as matched resource: update `content`
					// property with snippet value
					this.content = value.data;
					if (this._text) {
						this.content = require('abbreviationUtils')
							.insertChildContent(value.data, this._text);
					}
				}
			}
			
			return this._data[name];
		},
		
		/**
		 * Returns name of current node
		 * @returns {String}
		 */
		name: function() {
			var res = this.matchedResource();
			if (require('elements').is(res, 'element')) {
				return res.name;
			}
			
			return this._name;
		},
		
		/**
		 * Returns list of attributes for current node
		 * @returns {Array}
		 */
		attributeList: function() {
			var attrs = [];
			
			var res = this.matchedResource();
			if (require('elements').is(res, 'element') && _.isArray(res.attributes)) {
				attrs = attrs.concat(res.attributes);
			}
			
			return optimizeAttributes(attrs.concat(this._attributes));
		},
		
		/**
		 * Returns or sets attribute value
		 * @param {String} name Attribute name
		 * @param {String} value New attribute value
		 * @returns {String}
		 */
		attribute: function(name, value) {
			if (arguments.length == 2) {
				// modifying attribute
				var ix = _.indexOf(_.pluck(this._attributes, 'name'), name.toLowerCase());
				if (~ix) {
					this._attributes[ix].value = value;
				} else {
					this._attributes.push({
						name: name,
						value: value
					});
				}
			}
			
			return (_.find(this.attributeList(), function(attr) {
				return attr.name == name;
			}) || {}).value;
		},
		
		/**
		 * Returns reference to the matched <code>element</code>, if any.
		 * See {@link elements} module for a list of available elements
		 * @returns {Object}
		 */
		matchedResource: function() {
			return this.data('resource');
		},
		
		/**
		 * Returns index of current node in parent‘s children list
		 * @returns {Number}
		 */
		index: function() {
			return this.parent ? _.indexOf(this.parent.children, this) : -1;
		},
		
		/**
		 * Sets how many times current element should be repeated
		 * @private
		 */
		_setRepeat: function(count) {
			if (count) {
				this.repeatCount = parseInt(count, 10) || 1;
			} else {
				this.hasImplicitRepeat = true;
			}
		},
		
		/**
		 * Sets abbreviation that belongs to current node
		 * @param {String} abbr
		 */
		setAbbreviation: function(abbr) {
			abbr = abbr || '';
			
			var that = this;
			
			// find multiplier
			abbr = abbr.replace(/\*(\d+)?$/, function(str, repeatCount) {
				that._setRepeat(repeatCount);
				return '';
			});
			
			this.abbreviation = abbr;
			
			var abbrText = extractText(abbr);
			if (abbrText) {
				abbr = abbrText.element;
				this.content = this._text = abbrText.text;
			}
			
			var abbrAttrs = parseAttributes(abbr);
			if (abbrAttrs) {
				abbr = abbrAttrs.element;
				this._attributes = abbrAttrs.attributes;
			}
			
			this._name = abbr;
			
			// validate name
			if (this._name && !reValidName.test(this._name)) {
				throw 'Invalid abbreviation';
			}
		},
		
		/**
		 * Returns string representation of current node
		 * @return {String}
		 */
		toString: function() {
			var utils = require('utils');
			
			var start = this.start;
			var end = this.end;
			var content = this.content;
			
			// apply output processors
			var node = this;
			_.each(outputProcessors, function(fn) {
				start = fn(start, node, 'start');
				content = fn(content, node, 'content');
				end = fn(end, node, 'end');
			});
			
			
			var innerContent = _.map(this.children, function(child) {
				return child.toString();
			}).join('');
			
			content = require('abbreviationUtils').insertChildContent(content, innerContent, {
				keepVariable: false
			});
			
			return start + utils.padString(content, this.padding) + end;
		},
		
		/**
		 * Check if current node contains children with empty <code>expr</code>
		 * property
		 * @return {Boolean}
		 */
		hasEmptyChildren: function() {
			return !!_.find(this.children, function(child) {
				return child.isEmpty();
			});
		},
		
		/**
		 * Check if current node has implied name that should be resolved
		 * @returns {Boolean}
		 */
		hasImplicitName: function() {
			return !this._name && !this.isTextNode();
		},
		
		/**
		 * Indicates that current element is a grouping one, e.g. has no 
		 * representation but serves as a container for other nodes
		 * @returns {Boolean}
		 */
		isGroup: function() {
			return !this.abbreviation;
		},
		
		/**
		 * Indicates empty node (i.e. without abbreviation). It may be a 
		 * grouping node and should not be outputted
		 * @return {Boolean}
		 */
		isEmpty: function() {
			return !this.abbreviation && !this.children.length;
		},
		
		/**
		 * Indicates that current node should be repeated
		 * @returns {Boolean}
		 */
		isRepeating: function() {
			return this.repeatCount > 1 || this.hasImplicitRepeat;
		},
		
		/**
		 * Check if current node is a text-only node
		 * @return {Boolean}
		 */
		isTextNode: function() {
			return !this.name() && !this.attributeList().length;
		},
		
		/**
		 * Indicates whether this node may be used to build elements or snippets
		 * @returns {Boolean}
		 */
		isElement: function() {
			return !this.isEmpty() && !this.isTextNode();
		},
		
		/**
		 * Returns latest and deepest child of current tree
		 * @returns {AbbreviationNode}
		 */
		deepestChild: function() {
			if (!this.children.length)
				return null;
				
			var deepestChild = this;
			while (deepestChild.children.length) {
				deepestChild = _.last(deepestChild.children);
			}
			
			return deepestChild;
		}
	};
	
	/**
	 * Returns stripped string: a string without first and last character.
	 * Used for “unquoting” strings
	 * @param {String} str
	 * @returns {String}
	 */
	function stripped(str) {
		return str.substring(1, str.length - 1);
	}
	
	function consumeQuotedValue(stream, quote) {
		var ch;
		while (ch = stream.next()) {
			if (ch === quote)
				return true;
			
			if (ch == '\\')
				continue;
		}
		
		return false;
	}
	
	/**
	 * Parses abbreviation into a tree
	 * @param {String} abbr
	 * @returns {AbbreviationNode}
	 */
	function parseAbbreviation(abbr) {
		abbr = require('utils').trim(abbr);
		
		var root = new AbbreviationNode;
		var context = root.addChild(), ch;
		
		/** @type StringStream */
		var stream = require('stringStream').create(abbr);
		var loopProtector = 1000, multiplier;
		
		while (!stream.eol() && --loopProtector > 0) {
			ch = stream.peek();
			
			switch (ch) {
				case '(': // abbreviation group
					stream.start = stream.pos;
					if (stream.skipToPair('(', ')')) {
						var inner = parseAbbreviation(stripped(stream.current()));
						if (multiplier = stream.match(/^\*(\d+)?/, true)) {
							context._setRepeat(multiplier[1]);
						}
						
						_.each(inner.children, function(child) {
							context.addChild(child);
						});
					} else {
						throw 'Invalid abbreviation: mo matching ")" found for character at ' + stream.pos;
					}
					break;
					
				case '>': // child operator
					context = context.addChild();
					stream.next();
					break;
					
				case '+': // sibling operator
					context = context.parent.addChild();
					stream.next();
					break;
					
				case '^': // climb up operator
					var parent = context.parent || context;
					context = (parent.parent || parent).addChild();
					stream.next();
					break;
					
				default: // consume abbreviation
					stream.start = stream.pos;
					stream.eatWhile(function(c) {
						if (c == '[' || c == '{') {
							if (stream.skipToPair(c, pairs[c])) {
								stream.backUp(1);
								return true;
							}
							
							throw 'Invalid abbreviation: mo matching "' + pairs[c] + '" found for character at ' + stream.pos;
						}
						
						if (c == '+') {
							// let's see if this is an expando marker
							stream.next();
							var isMarker = stream.eol() ||  ~'+>^*'.indexOf(stream.peek());
							stream.backUp(1);
							return isMarker;
						}
						
						return c != '(' && isAllowedChar(c);
					});
					
					context.setAbbreviation(stream.current());
					stream.start = stream.pos;
			}
		}
		
		if (loopProtector < 1)
			throw 'Endless loop detected';
		
		return root;
	}
	
	/**
	 * Extract attributes and their values from attribute set: 
	 * <code>[attr col=3 title="Quoted string"]</code>
	 * @param {String} attrSet
	 * @returns {Array}
	 */
	function extractAttributes(attrSet, attrs) {
		attrSet = require('utils').trim(attrSet);
		var result = [];
		
		/** @type StringStream */
		var stream = require('stringStream').create(attrSet);
		stream.eatSpace();
		
		while (!stream.eol()) {
			stream.start = stream.pos;
			if (stream.eatWhile(reWord)) {
				var attrName = stream.current();
				var attrValue = '';
				if (stream.peek() == '=') {
					stream.next();
					stream.start = stream.pos;
					var quote = stream.peek();
					
					if (quote == '"' || quote == "'") {
						stream.next();
						if (consumeQuotedValue(stream, quote)) {
							attrValue = stream.current();
							// strip quotes
							attrValue = attrValue.substring(1, attrValue.length - 1);
						} else {
							throw 'Invalid attribute value';
						}
					} else if (stream.eatWhile(/[^\s\]]/)) {
						attrValue = stream.current();
					} else {
						throw 'Invalid attribute value';
					}
				}
				
				result.push({
					name: attrName, 
					value: attrValue
				});
				stream.eatSpace();
			} else {
				break;
			}
		}
		
		return result;
	}
	
	/**
	 * Parses tag attributes extracted from abbreviation. If attributes found, 
	 * returns object with <code>element</code> and <code>attributes</code>
	 * properties
	 * @param {String} abbr
	 * @returns {Object} Returns <code>null</code> if no attributes found in 
	 * abbreviation
	 */
	function parseAttributes(abbr) {
		/*
		 * Example of incoming data:
		 * #header
		 * .some.data
		 * .some.data#header
		 * [attr]
		 * #item[attr=Hello other="World"].class
		 */
		var result = [];
		var attrMap = {'#': 'id', '.': 'class'};
		var nameEnd = null;
		
		/** @type StringStream */
		var stream = require('stringStream').create(abbr);
		while (!stream.eol()) {
			switch (stream.peek()) {
				case '#': // id
				case '.': // class
					if (nameEnd === null)
						nameEnd = stream.pos;
					
					var attrName = attrMap[stream.peek()];
					
					stream.next();
					stream.start = stream.pos;
					stream.eatWhile(reWord);
					result.push({
						name: attrName, 
						value: stream.current()
					});
					break;
				case '[': //begin attribute set
					if (nameEnd === null)
						nameEnd = stream.pos;
					
					stream.start = stream.pos;
					if (!stream.skipToPair('[', ']')) 
						throw 'Invalid attribute set definition';
					
					result = result.concat(
						extractAttributes(stripped(stream.current()))
					);
					break;
				default:
					stream.next();
			}
		}
		
		if (!result.length)
			return null;
		
		return {
			element: abbr.substring(0, nameEnd),
			attributes: optimizeAttributes(result)
		};
	}
	
	/**
	 * Optimize attribute set: remove duplicates and merge class attributes
	 * @param attrs
	 */
	function optimizeAttributes(attrs) {
		// clone all attributes to make sure that original objects are 
		// not modified
		attrs  = _.map(attrs, function(attr) {
			return _.clone(attr);
		});
		
		var lookup = {};
		return _.filter(attrs, function(attr) {
			if (!(attr.name in lookup)) {
				return lookup[attr.name] = attr;
			}
			
			var la = lookup[attr.name];
			
			if (attr.name.toLowerCase() == 'class') {
				la.value += (la.value.length ? ' ' : '') + attr.value;
			} else {
				la.value = attr.value;
			}
			
			return false;
		});
	}
	
	/**
	 * Extract text data from abbreviation: if <code>a{hello}</code> abbreviation
	 * is passed, returns object <code>{element: 'a', text: 'hello'}</code>.
	 * If nothing found, returns <code>null</code>
	 * @param {String} abbr
	 * 
	 */
	function extractText(abbr) {
		if (!~abbr.indexOf('{'))
			return null;
		
		/** @type StringStream */
		var stream = require('stringStream').create(abbr);
		while (!stream.eol()) {
			switch (stream.peek()) {
				case '[':
				case '(':
					stream.skipToPair(stream.peek(), pairs[stream.peek()]); break;
					
				case '{':
					stream.start = stream.pos;
					stream.skipToPair('{', '}');
					return {
						element: abbr.substring(0, stream.start),
						text: stripped(stream.current())
					};
					
				default:
					stream.next();
			}
		}
	}
	
	/**
	 * “Un-rolls“ contents of current node: recursively replaces all repeating 
	 * children with their repeated clones
	 * @param {AbbreviationNode} node
	 * @returns {AbbreviationNode}
	 */
	function unroll(node) {
		for (var i = node.children.length - 1, j, child; i >= 0; i--) {
			child = node.children[i];
			
			if (child.isRepeating()) {
				j = child.repeatCount;
				child.repeatCount = 1;
				child.updateProperty('counter', 1);
				while (--j > 0) {
					child.parent.addChild(child.clone(), i + 1)
						.updateProperty('counter', j + 1);
				}
			}
		}
		
		// to keep proper 'counter' property, we need to walk
		// on children once again
		_.each(node.children, unroll);
		
		return node;
	}
	
	/**
	 * Optimizes tree node: replaces empty nodes with their children
	 * @param {AbbreviationNode} node
	 * @return {AbbreviationNode}
	 */
	function squash(node) {
		for (var i = node.children.length - 1; i >= 0; i--) {
			/** @type AbbreviationNode */
			var n = node.children[i];
			if (n.isGroup()) {
				n.replace(squash(n).children);
			} else if (n.isEmpty()) {
				n.remove();
			}
		}
		
		_.each(node.children, squash);
		
		return node;
	}
	
	function isAllowedChar(ch) {
		var charCode = ch.charCodeAt(0);
		var specialChars = '#.*:$-_!@|';
		
		return (charCode > 64 && charCode < 91)       // uppercase letter
				|| (charCode > 96 && charCode < 123)  // lowercase letter
				|| (charCode > 47 && charCode < 58)   // number
				|| specialChars.indexOf(ch) != -1;    // special character
	}
	
	// XXX add counter replacer function as output processor
	outputProcessors.push(function(text, node) {
		return require('utils').replaceCounter(text, node.counter);
	});
	
	return {
		/**
		 * Parses abbreviation into tree with respect of groups, 
		 * text nodes and attributes. Each node of the tree is a single 
		 * abbreviation. Tree represents actual structure of the outputted 
		 * result
		 * @memberOf abbreviationParser
		 * @param {String} abbr Abbreviation to parse
		 * @param {Object} options Additional options for parser and processors
		 * 
		 * @return {AbbreviationNode}
		 */
		parse: function(abbr, options) {
			options = options || {};
			
			var tree = parseAbbreviation(abbr);
			
			if (options.contextNode) {
				// add info about context node –
				// a parent XHTML node in editor inside which abbreviation is 
				// expanded
				tree._name = options.contextNode.name;
				var attrLookup = {};
				_.each(tree._attributes, function(attr) {
					attrLookup[attr.name] = attr;
				});
				
				_.each(options.contextNode.attributes, function(attr) {
					if (attr.name in attrLookup) {
						attrLookup[attr.name].value = attr.value;
					} else {
						attr = _.clone(attr);
						tree._attributes.push(attr);
						attrLookup[attr.name] = attr;
					}
				});
			}
			
			
			// apply preprocessors
			_.each(preprocessors, function(fn) {
				fn(tree, options);
			});
			
			tree = squash(unroll(tree));
			
			// apply postprocessors
			_.each(postprocessors, function(fn) {
				fn(tree, options);
			});
			
			return tree;
		},
		
		AbbreviationNode: AbbreviationNode,
		
		/**
		 * Add new abbreviation preprocessor. <i>Preprocessor</i> is a function
		 * that applies to a parsed abbreviation tree right after it get parsed.
		 * The passed tree is in unoptimized state.
		 * @param {Function} fn Preprocessor function. This function receives
		 * two arguments: parsed abbreviation tree (<code>AbbreviationNode</code>)
		 * and <code>options</code> hash that was passed to <code>parse</code>
		 * method
		 */
		addPreprocessor: function(fn) {
			if (!_.include(preprocessors, fn))
				preprocessors.push(fn);
		},
		
		/**
		 * Removes registered preprocessor
		 */
		removeFilter: function(fn) {
			preprocessor = _.without(preprocessors, fn);
		},
		
		/**
		 * Adds new abbreviation postprocessor. <i>Postprocessor</i> is a 
		 * functinon that applies to <i>optimized</i> parsed abbreviation tree
		 * right before it returns from <code>parse()</code> method
		 * @param {Function} fn Postprocessor function. This function receives
		 * two arguments: parsed abbreviation tree (<code>AbbreviationNode</code>)
		 * and <code>options</code> hash that was passed to <code>parse</code>
		 * method
		 */
		addPostprocessor: function(fn) {
			if (!_.include(postprocessors, fn))
				postprocessors.push(fn);
		},
		
		/**
		 * Removes registered postprocessor function
		 */
		removePostprocessor: function(fn) {
			postprocessors = _.without(postprocessors, fn);
		},
		
		/**
		 * Registers output postprocessor. <i>Output processor</i> is a 
		 * function that applies to output part (<code>start</code>, 
		 * <code>end</code> and <code>content</code>) when 
		 * <code>AbbreviationNode.toString()</code> method is called
		 */
		addOutputProcessor: function(fn) {
			if (!_.include(outputProcessors, fn))
				outputProcessors.push(fn);
		},
		
		/**
		 * Removes registered output processor
		 */
		removeOutputProcessor: function(fn) {
			outputProcessors = _.without(outputProcessors, fn);
		},
		
		/**
		 * Check if passed symbol is valid symbol for abbreviation expression
		 * @param {String} ch
		 * @return {Boolean}
		 */
		isAllowedChar: function(ch) {
			ch = String(ch); // convert Java object to JS
			return isAllowedChar(ch) || ~'>+^[](){}'.indexOf(ch);
		}
	};
});/**
 * Processor function that matches parsed <code>AbbreviationNode</code>
 * against resources defined in <code>resource</code> module
 * @param {Function} require
 * @param {Underscore} _
 */ 
emmet.exec(function(require, _) {
	/**
	 * Finds matched resources for child nodes of passed <code>node</code> 
	 * element. A matched resource is a reference to <i>snippets.json</i> entry
	 * that describes output of parsed node 
	 * @param {AbbreviationNode} node
	 * @param {String} syntax
	 */
	function matchResources(node, syntax) {
		var resources = require('resources');
		var elements = require('elements');
		var parser = require('abbreviationParser');
		
		// do a shallow copy because the children list can be modified during
		// resource matching
		_.each(_.clone(node.children), /** @param {AbbreviationNode} child */ function(child) {
			var r = resources.getMatchedResource(child, syntax);
			if (_.isString(r)) {
				child.data('resource', elements.create('snippet', r));
			} else if (elements.is(r, 'reference')) {
				// it’s a reference to another abbreviation:
				// parse it and insert instead of current child
				/** @type AbbreviationNode */
				var subtree = parser.parse(r.data, {
					syntax: syntax
				});
				
				// if context element should be repeated, check if we need to 
				// transfer repeated element to specific child node
				if (child.repeatCount > 1) {
					var repeatedChildren = subtree.findAll(function(node) {
						return node.hasImplicitRepeat;
					});
					
					_.each(repeatedChildren, function(node) {
						node.repeatCount = child.repeatCount;
						node.hasImplicitRepeat = false;
					});
				}
				
				// move child‘s children into the deepest child of new subtree
				var deepestChild = subtree.deepestChild();
				if (deepestChild) {
					_.each(child.children, function(c) {
						deepestChild.addChild(c);
					});
				}
				
				// copy current attributes to children
				_.each(subtree.children, function(node) {
					_.each(child.attributeList(), function(attr) {
						node.attribute(attr.name, attr.value);
					});
				});
				
				child.replace(subtree.children);
			} else {
				child.data('resource', r);
			}
			
			matchResources(child, syntax);
		});
	}
	
	// XXX register abbreviation filter that creates references to resources
	// on abbreviation nodes
	/**
	 * @param {AbbreviationNode} tree
	 */
	require('abbreviationParser').addPreprocessor(function(tree, options) {
		var syntax = options.syntax || emmet.defaultSyntax();
		matchResources(tree, syntax);
	});
	
});/**
 * Pasted content abbreviation processor. A pasted content is a content that
 * should be inserted into implicitly repeated abbreviation nodes.
 * This processor powers “Wrap With Abbreviation” action
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _) {
	var parser = require('abbreviationParser');
	var outputPlaceholder = '$#';
	
	/**
	 * Locates output placeholders inside text
	 * @param {String} text
	 * @returns {Array} Array of ranges of output placeholder in text
	 */
	function locateOutputPlaceholder(text) {
		var range = require('range');
		var result = [];
		
		/** @type StringStream */
		var stream = require('stringStream').create(text);
		
		while (!stream.eol()) {
			if (stream.peek() == '\\') {
				stream.next();
			} else {
				stream.start = stream.pos;
				if (stream.match(outputPlaceholder, true)) {
					result.push(range.create(stream.start, outputPlaceholder));
					continue;
				}
			}
			stream.next();
		}
		
		return result;
	}
	
	/**
	 * Replaces output placeholders inside <code>source</code> with 
	 * <code>value</code>
	 * @param {String} source
	 * @param {String} value
	 * @returns {String}
	 */
	function replaceOutputPlaceholders(source, value) {
		var utils = require('utils');
		var ranges = locateOutputPlaceholder(source);
		
		ranges.reverse();
		_.each(ranges, function(r) {
			source = utils.replaceSubstring(source, value, r);
		});
		
		return source;
	}
	
	/**
	 * Check if parsed node contains output placeholder – a target where
	 * pasted content should be inserted
	 * @param {AbbreviationNode} node
	 * @returns {Boolean}
	 */
	function hasOutputPlaceholder(node) {
		if (locateOutputPlaceholder(node.content).length)
			return true;
		
		// check if attributes contains placeholder
		return !!_.find(node.attributeList(), function(attr) {
			return !!locateOutputPlaceholder(attr.value).length;
		});
	}
	
	/**
	 * Insert pasted content into correct positions of parsed node
	 * @param {AbbreviationNode} node
	 * @param {String} content
	 * @param {Boolean} overwrite Overwrite node content if no value placeholders
	 * found instead of appending to existing content
	 */
	function insertPastedContent(node, content, overwrite) {
		var nodesWithPlaceholders = node.findAll(function(item) {
			return hasOutputPlaceholder(item);
		});
		
		if (hasOutputPlaceholder(node))
			nodesWithPlaceholders.unshift(node);
		
		if (nodesWithPlaceholders.length) {
			_.each(nodesWithPlaceholders, function(item) {
				item.content = replaceOutputPlaceholders(item.content, content);
				_.each(item._attributes, function(attr) {
					attr.value = replaceOutputPlaceholders(attr.value, content);
				});
			});
		} else {
			// on output placeholders in subtree, insert content in the deepest
			// child node
			var deepest = node.deepestChild() || node;
			if (overwrite) {
				deepest.content = content;
			} else {
				deepest.content = require('abbreviationUtils').insertChildContent(deepest.content, content);
			}
		}
	}
	
	/**
	 * @param {AbbreviationNode} tree
	 * @param {Object} options
	 */
	parser.addPreprocessor(function(tree, options) {
		if (options.pastedContent) {
			var utils = require('utils');
			var lines = _.map(utils.splitByLines(options.pastedContent, true), utils.trim);
			
			// set repeat count for implicitly repeated elements before
			// tree is unrolled
			tree.findAll(function(item) {
				if (item.hasImplicitRepeat) {
					item.data('paste', lines);
					return item.repeatCount = lines.length;
				}
			});
		}
	});
	
	/**
	 * @param {AbbreviationNode} tree
	 * @param {Object} options
	 */
	parser.addPostprocessor(function(tree, options) {
		// for each node with pasted content, update text data
		var targets = tree.findAll(function(item) {
			var pastedContentObj = item.data('paste');
			var pastedContent = '';
			if (_.isArray(pastedContentObj)) {
				pastedContent = pastedContentObj[item.counter - 1];
			} else if (_.isFunction(pastedContentObj)) {
				pastedContent = pastedContentObj(item.counter - 1, item.content);
			} else if (pastedContentObj) {
				pastedContent = pastedContentObj;
			}
			
			if (pastedContent) {
				insertPastedContent(item, pastedContent, !!item.data('pasteOverwrites'));
			}
			
			item.data('paste', null);
			return !!pastedContentObj;
		});
		
		if (!targets.length && options.pastedContent) {
			// no implicitly repeated elements, put pasted content in
			// the deepest child
			insertPastedContent(tree, options.pastedContent);
		}
	});
});/**
 * Resolves tag names in abbreviations with implied name
 */
emmet.exec(function(require, _) {
	/**
	 * Resolves implicit node names in parsed tree
	 * @param {AbbreviationNode} tree
	 */
	function resolveNodeNames(tree) {
		var tagName = require('tagName');
		_.each(tree.children, function(node) {
			if (node.hasImplicitName() || node.data('forceNameResolving')) {
				node._name = tagName.resolve(node.parent.name());
			}
			resolveNodeNames(node);
		});
		
		return tree;
	}
	
	require('abbreviationParser').addPostprocessor(resolveNodeNames);
});/**
 * @author Stoyan Stefanov
 * @link https://github.com/stoyan/etc/tree/master/cssex
 */

emmet.define('cssParser', function(require, _) {
var walker, tokens = [], isOp, isNameChar, isDigit;
    
    // walks around the source
    walker = {
        lines: null,
        total_lines: 0,
        linenum: -1,
        line: '',
        ch: '',
        chnum: -1,
        init: function (source) {
            var me = walker;
        
            // source, yumm
            me.lines = source
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .split('\n');
            me.total_lines = me.lines.length;
        
            // reset
            me.chnum = -1;
            me.linenum = -1;
            me.ch = '';
            me.line = '';
        
            // advance
            me.nextLine();
            me.nextChar();
        },
        nextLine: function () {
            var me = this;
            me.linenum += 1;
            if (me.total_lines <= me.linenum) {
                me.line = false;
            } else {
                me.line = me.lines[me.linenum];
            }
            if (me.chnum !== -1) {
                me.chnum = 0;
            }
            return me.line;
        }, 
        nextChar: function () {
            var me = this;
            me.chnum += 1;
            while (me.line.charAt(me.chnum) === '') {
                if (this.nextLine() === false) {
                    me.ch = false;
                    return false; // end of source
                }
                me.chnum = -1;
                me.ch = '\n';
                return '\n';
            }
            me.ch = me.line.charAt(me.chnum);
            return me.ch;
        },
        peek: function() {
            return this.line.charAt(this.chnum + 1);
        }
    };

    // utility helpers
    isNameChar = function (c) {
    	// be more tolerate for name tokens: allow & character for LESS syntax
        return (c == '&' || c === '_' || c === '-' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'));
    };

    isDigit = function (ch) {
        return (ch !== false && ch >= '0' && ch <= '9');
    };  

    isOp = (function () {
        var opsa = "{}[]()+*=.,;:>~|\\%$#@^!".split(''),
            opsmatcha = "*^|$~".split(''),
            ops = {},
            opsmatch = {},
            i = 0;
        for (; i < opsa.length; i += 1) {
            ops[opsa[i]] = true;
        }
        for (i = 0; i < opsmatcha.length; i += 1) {
            opsmatch[opsmatcha[i]] = true;
        }
        return function (ch, matchattr) {
            if (matchattr) {
                return !!opsmatch[ch];
            }
            return !!ops[ch];
        };
    }());
    
    // shorthands
    function isset(v) {
        return typeof v !== 'undefined';
    }
    function getConf() {
        return {
            'char': walker.chnum,
            line: walker.linenum
        };
    }


    // creates token objects and pushes them to a list
    function tokener(value, type, conf) {
        var w = walker, c = conf || {};
        tokens.push({
            charstart: isset(c['char']) ? c['char'] : w.chnum,
            charend:   isset(c.charend) ? c.charend : w.chnum,
            linestart: isset(c.line)    ? c.line    : w.linenum,
            lineend:   isset(c.lineend) ? c.lineend : w.linenum,
            value:     value,
            type:      type || value
        });
    }
    
    // oops
    function error(m, config) { 
        var w = walker,
            conf = config || {},
            c = isset(conf['char']) ? conf['char'] : w.chnum,
            l = isset(conf.line) ? conf.line : w.linenum;
        return {
            name: "ParseError",
            message: m + " at line " + (l + 1) + ' char ' + (c + 1),
            walker: w,
            tokens: tokens
        };
    }


    // token handlers follow for:
    // white space, comment, string, identifier, number, operator
    function white() {
    
        var c = walker.ch,
            token = '',
            conf = getConf();
    
        while (c === " " || c === "\t") {
            token += c;
            c = walker.nextChar();
        }
    
        tokener(token, 'white', conf);
    
    }

    function comment() {
    
        var w = walker,
            c = w.ch,
            token = c,
            cnext,
            conf = getConf();    
     
        cnext = w.nextChar();
        
        if (cnext !== '*') {
            // oops, not a comment, just a /
            conf.charend = conf['char'];
            conf.lineend = conf.line;
            return tokener(token, token, conf);
        }
    
        while (!(c === "*" && cnext === "/")) {
            token += cnext;
            c = cnext;
            cnext = w.nextChar();        
        }
        token += cnext;
        w.nextChar();
        tokener(token, 'comment', conf);
    }

    function str() {
        var w = walker,
            c = w.ch,
            q = c,
            token = c,
            cnext,
            conf = getConf();
    
        c = w.nextChar();
    
        while (c !== q) {
            
            if (c === '\n') {
                cnext = w.nextChar();
                if (cnext === "\\") {
                    token += c + cnext;
                } else {
                    // end of line with no \ escape = bad
                    throw error("Unterminated string", conf);
                }
            } else {
                if (c === "\\") {
                    token += c + w.nextChar();
                } else {
                    token += c;
                }
            }
        
            c = w.nextChar();
        
        }
        token += c;
        w.nextChar();
        tokener(token, 'string', conf);
    }
    
    function brace() {
        var w = walker,
            c = w.ch,
            depth = 0,
            token = c,
            conf = getConf();
    
        c = w.nextChar();
    
        while (c !== ')' && !depth) {
        	if (c === '(') {
        		depth++;
        	} else if (c === ')') {
        		depth--;
        	} else if (c === false) {
        		throw error("Unterminated brace", conf);
        	}
        	
        	token += c;
            c = w.nextChar();
        }
        
        token += c;
        w.nextChar();
        tokener(token, 'brace', conf);
    }

    function identifier(pre) {
        var w = walker,
            c = w.ch,
            conf = getConf(),
            token = (pre) ? pre + c : c;
            
        c = w.nextChar();
    
        if (pre) { // adjust token position
        	conf['char'] -= pre.length;
        }
        
        while (isNameChar(c) || isDigit(c)) {
            token += c;
            c = w.nextChar();
        }
    
        tokener(token, 'identifier', conf);    
    }

    function num() {
        var w = walker,
            c = w.ch,
            conf = getConf(),
            token = c,
            point = token === '.',
            nondigit;
        
        c = w.nextChar();
        nondigit = !isDigit(c);
    
        // .2px or .classname?
        if (point && nondigit) {
            // meh, NaN, could be a class name, so it's an operator for now
            conf.charend = conf['char'];
            conf.lineend = conf.line;
            return tokener(token, '.', conf);    
        }
        
        // -2px or -moz-something
        if (token === '-' && nondigit) {
            return identifier('-');
        }
    
        while (c !== false && (isDigit(c) || (!point && c === '.'))) { // not end of source && digit or first instance of .
            if (c === '.') {
                point = true;
            }
            token += c;
            c = w.nextChar();
        }

        tokener(token, 'number', conf);    
    
    }

    function op() {
        var w = walker,
            c = w.ch,
            conf = getConf(),
            token = c,
            next = w.nextChar();
            
        if (next === "=" && isOp(token, true)) {
            token += next;
            tokener(token, 'match', conf);
            w.nextChar();
            return;
        } 
        
        conf.charend = conf['char'] + 1;
        conf.lineend = conf.line;    
        tokener(token, token, conf);
    }


    // call the appropriate handler based on the first character in a token suspect
    function tokenize() {

        var ch = walker.ch;
    
        if (ch === " " || ch === "\t") {
            return white();
        }

        if (ch === '/') {
            return comment();
        } 

        if (ch === '"' || ch === "'") {
            return str();
        }
        
        if (ch === '(') {
            return brace();
        }
    
        if (ch === '-' || ch === '.' || isDigit(ch)) { // tricky - char: minus (-1px) or dash (-moz-stuff)
            return num();
        }
    
        if (isNameChar(ch)) {
            return identifier();
        }

        if (isOp(ch)) {
            return op();
        }
        
        if (ch === "\n") {
            tokener("line");
            walker.nextChar();
            return;
        }
        
        throw error("Unrecognized character");
    }
    
    /**
	 * Returns newline character at specified position in content
	 * @param {String} content
	 * @param {Number} pos
	 * @return {String}
	 */
	function getNewline(content, pos) {
		return content.charAt(pos) == '\r' && content.charAt(pos + 1) == '\n' 
			? '\r\n' 
			: content.charAt(pos);
	}

    return {
    	/**
    	 * @param source
    	 * @returns
    	 * @memberOf emmet.cssParser
    	 */
        lex: function (source) {
            walker.init(source);
            tokens = [];
            while (walker.ch !== false) {
                tokenize();            
            }
            return tokens;
        },
        
        /**
         * Tokenizes CSS source
         * @param {String} source
         * @returns {Array}
         */
        parse: function(source) {
        	// transform tokens
	 		var pos = 0;
	 		return _.map(this.lex(source), function(token) {
	 			if (token.type == 'line') {
	 				token.value = getNewline(source, pos);
	 			}
	 			
	 			return {
	 				type: token.type,
	 				start: pos,
	 				end: (pos += token.value.length)
	 			};
			});
		},
        
        toSource: function (toks) {
            var i = 0, max = toks.length, t, src = '';
            for (; i < max; i += 1) {
                t = toks[i];
                if (t.type === 'line') {
                    src += '\n';
                } else {
                    src += t.value;
                }
            }
            return src;
        }
    };
});/**
 * HTML tokenizer by Marijn Haverbeke
 * http://codemirror.net/
 * @constructor
 * @memberOf __xmlParseDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.define('xmlParser', function(require, _) {
	var Kludges = {
		autoSelfClosers : {},
		implicitlyClosed : {},
		contextGrabbers : {},
		doNotIndent : {},
		allowUnquoted : true,
		allowMissing : true
	};

	// Return variables for tokenizers
	var tagName = null, type = null;

	function inText(stream, state) {
		function chain(parser) {
			state.tokenize = parser;
			return parser(stream, state);
		}

		var ch = stream.next();
		if (ch == "<") {
			if (stream.eat("!")) {
				if (stream.eat("[")) {
					if (stream.match("CDATA["))
						return chain(inBlock("atom", "]]>"));
					else
						return null;
				} else if (stream.match("--"))
					return chain(inBlock("comment", "-->"));
				else if (stream.match("DOCTYPE", true, true)) {
					stream.eatWhile(/[\w\._\-]/);
					return chain(doctype(1));
				} else
					return null;
			} else if (stream.eat("?")) {
				stream.eatWhile(/[\w\._\-]/);
				state.tokenize = inBlock("meta", "?>");
				return "meta";
			} else {
				type = stream.eat("/") ? "closeTag" : "openTag";
				stream.eatSpace();
				tagName = "";
				var c;
				while ((c = stream.eat(/[^\s\u00a0=<>\"\'\/?]/)))
					tagName += c;
				state.tokenize = inTag;
				return "tag";
			}
		} else if (ch == "&") {
			var ok;
			if (stream.eat("#")) {
				if (stream.eat("x")) {
					ok = stream.eatWhile(/[a-fA-F\d]/) && stream.eat(";");
				} else {
					ok = stream.eatWhile(/[\d]/) && stream.eat(";");
				}
			} else {
				ok = stream.eatWhile(/[\w\.\-:]/) && stream.eat(";");
			}
			return ok ? "atom" : "error";
		} else {
			stream.eatWhile(/[^&<]/);
			return "text";
		}
	}

	function inTag(stream, state) {
		var ch = stream.next();
		if (ch == ">" || (ch == "/" && stream.eat(">"))) {
			state.tokenize = inText;
			type = ch == ">" ? "endTag" : "selfcloseTag";
			return "tag";
		} else if (ch == "=") {
			type = "equals";
			return null;
		} else if (/[\'\"]/.test(ch)) {
			state.tokenize = inAttribute(ch);
			return state.tokenize(stream, state);
		} else {
			stream.eatWhile(/[^\s\u00a0=<>\"\'\/?]/);
			return "word";
		}
	}

	function inAttribute(quote) {
		return function(stream, state) {
			while (!stream.eol()) {
				if (stream.next() == quote) {
					state.tokenize = inTag;
					break;
				}
			}
			return "string";
		};
	}

	function inBlock(style, terminator) {
		return function(stream, state) {
			while (!stream.eol()) {
				if (stream.match(terminator)) {
					state.tokenize = inText;
					break;
				}
				stream.next();
			}
			return style;
		};
	}
	
	function doctype(depth) {
		return function(stream, state) {
			var ch;
			while ((ch = stream.next()) != null) {
				if (ch == "<") {
					state.tokenize = doctype(depth + 1);
					return state.tokenize(stream, state);
				} else if (ch == ">") {
					if (depth == 1) {
						state.tokenize = inText;
						break;
					} else {
						state.tokenize = doctype(depth - 1);
						return state.tokenize(stream, state);
					}
				}
			}
			return "meta";
		};
	}

	var curState = null, setStyle;
	function pass() {
		for (var i = arguments.length - 1; i >= 0; i--)
			curState.cc.push(arguments[i]);
	}
	
	function cont() {
		pass.apply(null, arguments);
		return true;
	}

	function pushContext(tagName, startOfLine) {
		var noIndent = Kludges.doNotIndent.hasOwnProperty(tagName) 
			|| (curState.context && curState.context.noIndent);
		curState.context = {
			prev : curState.context,
			tagName : tagName,
			indent : curState.indented,
			startOfLine : startOfLine,
			noIndent : noIndent
		};
	}
	
	function popContext() {
		if (curState.context)
			curState.context = curState.context.prev;
	}

	function element(type) {
		if (type == "openTag") {
			curState.tagName = tagName;
			return cont(attributes, endtag(curState.startOfLine));
		} else if (type == "closeTag") {
			var err = false;
			if (curState.context) {
				if (curState.context.tagName != tagName) {
					if (Kludges.implicitlyClosed.hasOwnProperty(curState.context.tagName.toLowerCase())) {
						popContext();
					}
					err = !curState.context || curState.context.tagName != tagName;
				}
			} else {
				err = true;
			}
			
			if (err)
				setStyle = "error";
			return cont(endclosetag(err));
		}
		return cont();
	}
	
	function endtag(startOfLine) {
		return function(type) {
			if (type == "selfcloseTag"
					|| (type == "endTag" && Kludges.autoSelfClosers
							.hasOwnProperty(curState.tagName
									.toLowerCase()))) {
				maybePopContext(curState.tagName.toLowerCase());
				return cont();
			}
			if (type == "endTag") {
				maybePopContext(curState.tagName.toLowerCase());
				pushContext(curState.tagName, startOfLine);
				return cont();
			}
			return cont();
		};
	}
	
	function endclosetag(err) {
		return function(type) {
			if (err)
				setStyle = "error";
			if (type == "endTag") {
				popContext();
				return cont();
			}
			setStyle = "error";
			return cont(arguments.callee);
		};
	}
	
	function maybePopContext(nextTagName) {
		var parentTagName;
		while (true) {
			if (!curState.context) {
				return;
			}
			parentTagName = curState.context.tagName.toLowerCase();
			if (!Kludges.contextGrabbers.hasOwnProperty(parentTagName)
					|| !Kludges.contextGrabbers[parentTagName].hasOwnProperty(nextTagName)) {
				return;
			}
			popContext();
		}
	}

	function attributes(type) {
		if (type == "word") {
			setStyle = "attribute";
			return cont(attribute, attributes);
		}
		if (type == "endTag" || type == "selfcloseTag")
			return pass();
		setStyle = "error";
		return cont(attributes);
	}
	
	function attribute(type) {
		if (type == "equals")
			return cont(attvalue, attributes);
		if (!Kludges.allowMissing)
			setStyle = "error";
		return (type == "endTag" || type == "selfcloseTag") ? pass()
				: cont();
	}
	
	function attvalue(type) {
		if (type == "string")
			return cont(attvaluemaybe);
		if (type == "word" && Kludges.allowUnquoted) {
			setStyle = "string";
			return cont();
		}
		setStyle = "error";
		return (type == "endTag" || type == "selfCloseTag") ? pass()
				: cont();
	}
	
	function attvaluemaybe(type) {
		if (type == "string")
			return cont(attvaluemaybe);
		else
			return pass();
	}
	
	function startState() {
		return {
			tokenize : inText,
			cc : [],
			indented : 0,
			startOfLine : true,
			tagName : null,
			context : null
		};
	}
	
	function token(stream, state) {
		if (stream.sol()) {
			state.startOfLine = true;
			state.indented = 0;
		}
		
		if (stream.eatSpace())
			return null;

		setStyle = type = tagName = null;
		var style = state.tokenize(stream, state);
		state.type = type;
		if ((style || type) && style != "comment") {
			curState = state;
			while (true) {
				var comb = state.cc.pop() || element;
				if (comb(type || style))
					break;
			}
		}
		state.startOfLine = false;
		return setStyle || style;
	}

	return {
		/**
		 * @memberOf emmet.xmlParser
		 * @returns
		 */
		parse: function(data, offset) {
			offset = offset || 0;
			var state = startState();
			var stream = require('stringStream').create(data);
			var tokens = [];
			while (!stream.eol()) {
				tokens.push({
					type: token(stream, state),
					start: stream.start + offset,
					end: stream.pos + offset
				});
				stream.start = stream.pos;
			}
			
			return tokens;
		}		
	};
});
/*!
 * string_score.js: String Scoring Algorithm 0.1.10 
 *
 * http://joshaven.com/string_score
 * https://github.com/joshaven/string_score
 *
 * Copyright (C) 2009-2011 Joshaven Potter <yourtech@gmail.com>
 * Special thanks to all of the contributors listed here https://github.com/joshaven/string_score
 * MIT license: http://www.opensource.org/licenses/mit-license.php
 *
 * Date: Tue Mar 1 2011
*/

/**
 * Scores a string against another string.
 *  'Hello World'.score('he');     //=> 0.5931818181818181
 *  'Hello World'.score('Hello');  //=> 0.7318181818181818
 */
emmet.define('string-score', function(require, _) {
	return {
		score: function(string, abbreviation, fuzziness) {
			// If the string is equal to the abbreviation, perfect match.
			  if (string == abbreviation) {return 1;}
			  //if it's not a perfect match and is empty return 0
			  if(abbreviation == "") {return 0;}

			  var total_character_score = 0,
			      abbreviation_length = abbreviation.length,
			      string_length = string.length,
			      start_of_string_bonus,
			      abbreviation_score,
			      fuzzies=1,
			      final_score;
			  
			  // Walk through abbreviation and add up scores.
			  for (var i = 0,
			         character_score/* = 0*/,
			         index_in_string/* = 0*/,
			         c/* = ''*/,
			         index_c_lowercase/* = 0*/,
			         index_c_uppercase/* = 0*/,
			         min_index/* = 0*/;
			     i < abbreviation_length;
			     ++i) {
			    
			    // Find the first case-insensitive match of a character.
			    c = abbreviation.charAt(i);
			    
			    index_c_lowercase = string.indexOf(c.toLowerCase());
			    index_c_uppercase = string.indexOf(c.toUpperCase());
			    min_index = Math.min(index_c_lowercase, index_c_uppercase);
			    index_in_string = (min_index > -1) ? min_index : Math.max(index_c_lowercase, index_c_uppercase);
			    
			    if (index_in_string === -1) { 
			      if (fuzziness) {
			        fuzzies += 1-fuzziness;
			        continue;
			      } else {
			        return 0;
			      }
			    } else {
			      character_score = 0.1;
			    }
			    
			    // Set base score for matching 'c'.
			    
			    // Same case bonus.
			    if (string[index_in_string] === c) { 
			      character_score += 0.1; 
			    }
			    
			    // Consecutive letter & start-of-string Bonus
			    if (index_in_string === 0) {
			      // Increase the score when matching first character of the remainder of the string
			      character_score += 0.6;
			      if (i === 0) {
			        // If match is the first character of the string
			        // & the first character of abbreviation, add a
			        // start-of-string match bonus.
			        start_of_string_bonus = 1; //true;
			      }
			    }
			    else {
			  // Acronym Bonus
			  // Weighing Logic: Typing the first character of an acronym is as if you
			  // preceded it with two perfect character matches.
			  if (string.charAt(index_in_string - 1) === ' ') {
			    character_score += 0.8; // * Math.min(index_in_string, 5); // Cap bonus at 0.4 * 5
			  }
			    }
			    
			    // Left trim the already matched part of the string
			    // (forces sequential matching).
			    string = string.substring(index_in_string + 1, string_length);
			    
			    total_character_score += character_score;
			  } // end of for loop
			  
			  // Uncomment to weigh smaller words higher.
			  // return total_character_score / string_length;
			  
			  abbreviation_score = total_character_score / abbreviation_length;
			  //percentage_of_matched_string = abbreviation_length / string_length;
			  //word_score = abbreviation_score * percentage_of_matched_string;
			  
			  // Reduce penalty for longer strings.
			  //final_score = (word_score + abbreviation_score) / 2;
			  final_score = ((abbreviation_score * (abbreviation_length / string_length)) + abbreviation_score) / 2;
			  
			  final_score = final_score / fuzzies;
			  
			  if (start_of_string_bonus && (final_score + 0.15 < 1)) {
			    final_score += 0.15;
			  }
			  
			  return final_score;
		}
	};
});/**
 * Utility module for Emmet
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.define('utils', function(require, _) {
	/** 
	 * Special token used as a placeholder for caret positions inside 
	 * generated output 
	 */
	var caretPlaceholder = '${0}';
	
	/**
	 * A simple string builder, optimized for faster text concatenation
	 * @param {String} value Initial value
	 */
	function StringBuilder(value) {
		this._data = [];
		this.length = 0;
		
		if (value)
			this.append(value);
	}
	
	StringBuilder.prototype = {
		/**
		 * Append string
		 * @param {String} text
		 */
		append: function(text) {
			this._data.push(text);
			this.length += text.length;
		},
		
		/**
		 * @returns {String}
		 */
		toString: function() {
			return this._data.join('');
		},
		
		/**
		 * @returns {String}
		 */
		valueOf: function() {
			return this.toString();
		}
	};
	
	return {
		/** @memberOf utils */
		reTag: /<\/?[\w:\-]+(?:\s+[\w\-:]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*\s*(\/?)>$/,
		
		/**
		 * Test if passed string ends with XHTML tag. This method is used for testing
		 * '>' character: it belongs to tag or it's a part of abbreviation? 
		 * @param {String} str
		 * @return {Boolean}
		 */
		endsWithTag: function(str) {
			return this.reTag.test(str);
		},
		
		/**
		 * Check if passed symbol is a number
		 * @param {String} ch
		 * @returns {Boolean}
		 */
		isNumeric: function(ch) {
			if (typeof(ch) == 'string')
				ch = ch.charCodeAt(0);
				
			return (ch && ch > 47 && ch < 58);
		},
		
		/**
		 * Trim whitespace from string
		 * @param {String} text
		 * @return {String}
		 */
		trim: function(text) {
			return (text || "").replace(/^\s+|\s+$/g, "");
		},
		
		/**
		 * Returns newline character
		 * @returns {String}
		 */
		getNewline: function() {
			var res = require('resources');
			if (!res) {
				return '\n';
			}
			
			var nl = res.getVariable('newline');
			return _.isString(nl) ? nl : '\n';
		},
		
		/**
		 * Sets new newline character that will be used in output
		 * @param {String} str
		 */
		setNewline: function(str) {
			var res = require('resources');
			res.setVariable('newline', str);
			res.setVariable('nl', str);
		},
		
		/**
		 * Split text into lines. Set <code>remove_empty</code> to true to filter
		 * empty lines
		 * @param {String} text Text to split
		 * @param {Boolean} removeEmpty Remove empty lines from result
		 * @return {Array}
		 */
		splitByLines: function(text, removeEmpty) {
			// IE fails to split string by regexp, 
			// need to normalize newlines first
			// Also, Mozilla's Rhiho JS engine has a weird newline bug
			var nl = this.getNewline();
			var lines = (text || '')
				.replace(/\r\n/g, '\n')
				.replace(/\n\r/g, '\n')
				.replace(/\r/g, '\n')
				.replace(/\n/g, nl)
				.split(nl);
			
			if (removeEmpty) {
				lines = _.filter(lines, function(line) {
					return line.length && !!this.trim(line);
				}, this);
			}
			
			return lines;
		},
		
		/**
		 * Normalizes newline character: replaces newlines in <code>text</code> 
		 * with newline defined in preferences
		 * @param {String} text
		 * @returns {String}
		 */
		normalizeNewline: function(text) {
			return this.splitByLines(text).join(this.getNewline());
		},
		
		/**
		 * Repeats string <code>howMany</code> times
		 * @param {String} str
		 * @param {Number} how_many
		 * @return {String}
		 */
		repeatString: function(str, howMany) {
			var result = [];
			
			for (var i = 0; i < howMany; i++) 
				result.push(str);
				
			return result.join('');
		},
		
		/**
		 * Indents text with padding
		 * @param {String} text Text to indent
		 * @param {String} pad Padding size (number) or padding itself (string)
		 * @return {String}
		 */
		padString: function(text, pad) {
			var padStr = (_.isNumber(pad)) 
				? this.repeatString(require('resources').getVariable('indentation') || '\t', pad) 
				: pad;
				
			var result = [];
			
			var lines = this.splitByLines(text);
			var nl = this.getNewline();
				
			result.push(lines[0]);
			for (var j = 1; j < lines.length; j++) 
				result.push(nl + padStr + lines[j]);
				
			return result.join('');
		},
		
		/**
		 * Pad string with zeroes
		 * @param {String} str String to pad
		 * @param {Number} pad Desired string length
		 * @return {String}
		 */
		zeroPadString: function(str, pad) {
			var padding = '';
			var il = str.length;
				
			while (pad > il++) padding += '0';
			return padding + str; 
		},
		
		/**
		 * Removes padding at the beginning of each text's line
		 * @param {String} text
		 * @param {String} pad
		 */
		unindentString: function(text, pad) {
			var lines = this.splitByLines(text);
			for (var i = 0; i < lines.length; i++) {
				if (lines[i].search(pad) == 0)
					lines[i] = lines[i].substr(pad.length);
			}
			
			return lines.join(this.getNewline());
		},
		
		/**
		 * Replaces unescaped symbols in <code>str</code>. For example, the '$' symbol
		 * will be replaced in 'item$count', but not in 'item\$count'.
		 * @param {String} str Original string
		 * @param {String} symbol Symbol to replace
		 * @param {String} replace Symbol replacement. Might be a function that 
		 * returns new value
		 * @return {String}
		 */
		replaceUnescapedSymbol: function(str, symbol, replace) {
			var i = 0;
			var il = str.length;
			var sl = symbol.length;
			var matchCount = 0;
				
			while (i < il) {
				if (str.charAt(i) == '\\') {
					// escaped symbol, skip next character
					i += sl + 1;
				} else if (str.substr(i, sl) == symbol) {
					// have match
					var curSl = sl;
					matchCount++;
					var newValue = replace;
					if (_.isFunction(replace)) {
						var replaceData = replace(str, symbol, i, matchCount);
						if (replaceData) {
							curSl = replaceData[0].length;
							newValue = replaceData[1];
						} else {
							newValue = false;
						}
					}
					
					if (newValue === false) { // skip replacement
						i++;
						continue;
					}
					
					str = str.substring(0, i) + newValue + str.substring(i + curSl);
					// adjust indexes
					il = str.length;
					i += newValue.length;
				} else {
					i++;
				}
			}
			
			return str;
		},
		
		/**
		 * Replace variables like ${var} in string
		 * @param {String} str
		 * @param {Object} vars Variable set (defaults to variables defined in 
		 * <code>snippets.json</code>) or variable resolver (<code>Function</code>)
		 * @return {String}
		 */
		replaceVariables: function(str, vars) {
			vars = vars || {};
			var resolver = _.isFunction(vars) ? vars : function(str, p1) {
				return p1 in vars ? vars[p1] : null;
			};
			
			var res = require('resources');
			return require('tabStops').processText(str, {
				variable: function(data) {
					var newValue = resolver(data.token, data.name, data);
					if (newValue === null) {
						// try to find variable in resources
						newValue = res.getVariable(data.name);
					}
					
					if (newValue === null || _.isUndefined(newValue))
						// nothing found, return token itself
						newValue = data.token;
					return newValue;
				}
			});
		},
		
		/**
		 * Replaces '$' character in string assuming it might be escaped with '\'
		 * @param {String} str String where caracter should be replaced
		 * @param {String} value Replace value. Might be a <code>Function</code>
		 * @return {String}
		 */
		replaceCounter: function(str, value) {
			var symbol = '$';
			// in case we received strings from Java, convert the to native strings
			str = String(str);
			value = String(value);
			var that = this;
			return this.replaceUnescapedSymbol(str, symbol, function(str, symbol, pos, matchNum){
				if (str.charAt(pos + 1) == '{' || that.isNumeric(str.charAt(pos + 1)) ) {
					// it's a variable, skip it
					return false;
				}
				
				// replace sequense of $ symbols with padded number  
				var j = pos + 1;
				while(str.charAt(j) == '$' && str.charAt(j + 1) != '{') j++;
				return [str.substring(pos, j), that.zeroPadString(value, j - pos)];
			});
		},
		
		/**
		 * Check if string matches against <code>reTag</code> regexp. This 
		 * function may be used to test if provided string contains HTML tags
		 * @param {String} str
		 * @returns {Boolean}
		 */
		matchesTag: function(str) {
			return this.reTag.test(str || '');
		},
		
		/**
		 * Escapes special characters used in Emmet, like '$', '|', etc.
		 * Use this method before passing to actions like "Wrap with Abbreviation"
		 * to make sure that existing special characters won't be altered
		 * @param {String} text
		 * @return {String}
		 */
		escapeText: function(text) {
			return text.replace(/([\$\\])/g, '\\$1');
		},
		
		/**
		 * Unescapes special characters used in Emmet, like '$', '|', etc.
		 * @param {String} text
		 * @return {String}
		 */
		unescapeText: function(text) {
			return text.replace(/\\(.)/g, '$1');
		},
		
		/**
		 * Returns caret placeholder
		 * @returns {String}
		 */
		getCaretPlaceholder: function() {
			return _.isFunction(caretPlaceholder) 
				? caretPlaceholder.apply(this, arguments)
				: caretPlaceholder;
		},
		
		/**
		 * Sets new representation for carets in generated output
		 * @param {String} value New caret placeholder. Might be a 
		 * <code>Function</code>
		 */
		setCaretPlaceholder: function(value) {
			caretPlaceholder = value;
		},
		
		/**
		 * Returns line padding
		 * @param {String} line
		 * @return {String}
		 */
		getLinePadding: function(line) {
			return (line.match(/^(\s+)/) || [''])[0];
		},
		
		/**
		 * Helper function that returns padding of line of <code>pos</code>
		 * position in <code>content</code>
		 * @param {String} content
		 * @param {Number} pos
		 * @returns {String}
		 */
		getLinePaddingFromPosition: function(content, pos) {
			var lineRange = this.findNewlineBounds(content, pos);
			return this.getLinePadding(lineRange.substring(content));
		},
		
		/**
		 * Escape special regexp chars in string, making it usable for creating dynamic
		 * regular expressions
		 * @param {String} str
		 * @return {String}
		 */
		escapeForRegexp: function(str) {
			var specials = new RegExp("[.*+?|()\\[\\]{}\\\\]", "g"); // .*+?|()[]{}\
			return str.replace(specials, "\\$&");
		},
		
		/**
		 * Make decimal number look good: convert it to fixed precision end remove
		 * traling zeroes 
		 * @param {Number} num
		 * @param {Number} fracion Fraction numbers (default is 2)
		 * @return {String}
		 */
		prettifyNumber: function(num, fraction) {
			return num.toFixed(typeof fraction == 'undefined' ? 2 : fraction).replace(/\.?0+$/, '');
		},
		
		/**
		 * A simple mutable string shim, optimized for faster text concatenation
		 * @param {String} value Initial value
		 * @returns {StringBuilder}
		 */
		stringBuilder: function(value) {
			return new StringBuilder(value);
		},
		
		/**
		 * Replace substring of <code>str</code> with <code>value</code>
		 * @param {String} str String where to replace substring
		 * @param {String} value New substring value
		 * @param {Number} start Start index of substring to replace. May also
		 * be a <code>Range</code> object: in this case, the <code>end</code>
		 * argument is not required
		 * @param {Number} end End index of substring to replace. If ommited, 
		 * <code>start</code> argument is used
		 */
		replaceSubstring: function(str, value, start, end) {
			if (_.isObject(start) && 'end' in start) {
				end = start.end;
				start = start.start;
			}
			
			if (_.isString(end))
				end = start + end.length;
			
			if (_.isUndefined(end))
				end = start;
			
			if (start < 0 || start > str.length)
				return str;
			
			return str.substring(0, start) + value + str.substring(end);
		},
		
		/**
		 * Narrows down text range, adjusting selection to non-space characters
		 * @param {String} text
		 * @param {Number} start Starting range in <code>text</code> where 
		 * slection should be adjusted. Can also be any object that is accepted
		 * by <code>Range</code> class
		 * @return {Range}
		 */
		narrowToNonSpace: function(text, start, end) {
			var range = require('range').create(start, end);
			
			var reSpace = /[\s\n\r\u00a0]/;
			// narrow down selection until first non-space character
			while (range.start < range.end) {
				if (!reSpace.test(text.charAt(range.start)))
					break;
					
				range.start++;
			}
			
			while (range.end > range.start) {
				range.end--;
				if (!reSpace.test(text.charAt(range.end))) {
					range.end++;
					break;
				}
			}
			
			return range;
		},
		
		/**
		 * Find start and end index of text line for <code>from</code> index
		 * @param {String} text 
		 * @param {Number} from
		 */
		findNewlineBounds: function(text, from) {
			var len = text.length,
				start = 0,
				end = len - 1;
			
			// search left
			for (var i = from - 1; i > 0; i--) {
				var ch = text.charAt(i);
				if (ch == '\n' || ch == '\r') {
					start = i + 1;
					break;
				}
			}
			// search right
			for (var j = from; j < len; j++) {
				var ch = text.charAt(j);
				if (ch == '\n' || ch == '\r') {
					end = j;
					break;
				}
			}
			
			return require('range').create(start, end - start);
		},

		/**
		 * Deep merge of two or more objects. Taken from jQuery.extend()
		 */
		deepMerge: function() {
			var options, name, src, copy, copyIsArray, clone,
				target = arguments[0] || {},
				i = 1,
				length = arguments.length;


			// Handle case when target is a string or something (possible in deep copy)
			if (!_.isObject(target) && !_.isFunction(target)) {
				target = {};
			}

			for ( ; i < length; i++ ) {
				// Only deal with non-null/undefined values
				if ( (options = arguments[ i ]) != null ) {
					// Extend the base object
					for ( name in options ) {
						src = target[ name ];
						copy = options[ name ];

						// Prevent never-ending loop
						if ( target === copy ) {
							continue;
						}

						// Recurse if we're merging plain objects or arrays
						if ( copy && ( _.isObject(copy) || (copyIsArray = _.isArray(copy)) ) ) {
							if ( copyIsArray ) {
								copyIsArray = false;
								clone = src && _.isArray(src) ? src : [];

							} else {
								clone = src && _.isObject(src) ? src : {};
							}

							// Never move original objects, clone them
							target[ name ] = this.deepMerge(clone, copy );

						// Don't bring in undefined values
						} else if ( copy !== undefined ) {
							target[ name ] = copy;
						}
					}
				}
			}

			// Return the modified object
			return target;
		}
	};
});
/**
 * Helper module to work with ranges
 * @constructor
 * @memberOf __rangeDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.define('range', function(require, _) {
	/**
	 * @type Range
	 * @constructor
	 * @param {Object} start
	 * @param {Number} len
	 */
	function Range(start, len) {
		if (_.isObject(start) && 'start' in start) {
			// create range from object stub
			this.start = Math.min(start.start, start.end);
			this.end = Math.max(start.start, start.end);
		} else if (_.isArray(start)) {
			this.start = start[0];
			this.end = start[1];
		} else {
			len = _.isString(len) ? len.length : +len;
			this.start = start;
			this.end = start + len;
		}
	}
	
	Range.prototype = {
		length: function() {
			return Math.abs(this.end - this.start);
		},
		
		/**
		 * Returns <code>true</code> if passed range is equals to current one
		 * @param {Range} range
		 * @returns {Boolean}
		 */
		equal: function(range) {
			return this.start === range.start && this.end === range.end;
		},
		
		/**
		 * Shifts indexes position with passed <code>delat</code>
		 * @param {Number} delta
		 * @returns {Range} range itself
		 */
		shift: function(delta) {
			this.start += delta;
			this.end += delta;
			return this;
		},
		
		/**
		 * Check if two ranges are overlapped
		 * @param {Range} range
		 * @returns {Boolean}
		 */
		overlap: function(range) {
			return range.start <= this.end && range.end >= this.start;
		},
		
		/**
		 * Finds intersection of two ranges
		 * @param {Range} range
		 * @returns {Range} <code>null</code> if ranges does not overlap
		 */
		intersection: function(range) {
			if (this.overlap(range)) {
				var start = Math.max(range.start, this.start);
				var end = Math.min(range.end, this.end);
				return new Range(start, end - start);
			}
			
			return null;
		},
		
		/**
		 * Returns the union of the thow ranges.
		 * @param {Range} range
		 * @returns {Range} <code>null</code> if ranges are not overlapped
		 */
		union: function(range) {
			if (this.overlap(range)) {
				var start = Math.min(range.start, this.start);
				var end = Math.max(range.end, this.end);
				return new Range(start, end - start);
			}
			
			return null;
		},
		
		/**
		 * Returns a Boolean value that indicates whether a specified position 
		 * is in a given range.
		 * @param {Number} loc
		 */
		inside: function(loc) {
			return this.start <= loc && this.end > loc;
		},
		
		/**
		 * Check if current range completely includes specified one
		 * @param {Range} r
		 * @returns {Boolean} 
		 */
		include: function(r) {
			return this.start <= r.start && this.end >= r.end;
		},
		
		/**
		 * Returns substring of specified <code>str</code> for current range
		 * @param {String} str
		 * @returns {String}
		 */
		substring: function(str) {
			return this.length() > 0 
				? str.substring(this.start, this.end) 
				: '';
		},
		
		/**
		 * Creates copy of current range
		 * @returns {Range}
		 */
		clone: function() {
			return new Range(this.start, this.length());
		},
		
		/**
		 * @returns {Array}
		 */
		toArray: function() {
			return [this.start, this.end];
		},
		
		toString: function() {
			return '{' + this.start + ', ' + this.length() + '}';
		}
	};
	
	return {
		/**
		 * Creates new range object instance
		 * @param {Object} start Range start or array with 'start' and 'end'
		 * as two first indexes or object with 'start' and 'end' properties
		 * @param {Number} len Range length or string to produce range from
		 * @returns {Range}
		 * @memberOf emmet.range
		 */
		create: function(start, len) {
			if (_.isUndefined(start) || start === null)
				return null;
			
			if (start instanceof Range)
				return start;
			
			if (_.isObject(start) && 'start' in start && 'end' in start) {
				len = start.end - start.start;
				start = start.start;
			}
				
			return new Range(start, len);
		},
		
		/**
		 * <code>Range</code> object factory, the same as <code>this.create()</code>
		 * but last argument represents end of range, not length
		 * @returns {Range}
		 */
		create2: function(start, end) {
			if (_.isNumber(start) && _.isNumber(end)) {
				end -= start;
			}
			
			return this.create(start, end);
		}
	};
});/**
 * Utility module that provides ordered storage of function handlers. 
 * Many Emmet modules' functionality can be extended/overridden by custom
 * function. This modules provides unified storage of handler functions, their 
 * management and execution
 * 
 * @constructor
 * @memberOf __handlerListDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.define('handlerList', function(require, _) {
	/**
	 * @type HandlerList
	 * @constructor
	 */
	function HandlerList() {
		this._list = [];
	}
	
	HandlerList.prototype = {
		/**
		 * Adds function handler
		 * @param {Function} fn Handler
		 * @param {Object} options Handler options. Possible values are:<br><br>
		 * <b>order</b> : (<code>Number</code>) – order in handler list. Handlers
		 * with higher order value will be executed earlier.
		 */
		add: function(fn, options) {
			this._list.push(_.extend({order: 0}, options || {}, {fn: fn}));
		},
		
		/**
		 * Removes handler from list
		 * @param {Function} fn
		 */
		remove: function(fn) {
			this._list = _.without(this._list, _.find(this._list, function(item) {
				return item.fn === fn;
			}));
		},
		
		/**
		 * Returns ordered list of handlers. By default, handlers 
		 * with the same <code>order</code> option returned in reverse order, 
		 * i.e. the latter function was added into the handlers list, the higher 
		 * it will be in the returned array 
		 * @returns {Array}
		 */
		list: function() {
			return _.sortBy(this._list, 'order').reverse();
		},
		
		/**
		 * Returns ordered list of handler functions
		 * @returns {Array}
		 */
		listFn: function() {
			return _.pluck(this.list(), 'fn');
		},
		
		/**
		 * Executes handler functions in their designated order. If function
		 * returns <code>skipVal</code>, meaning that function was unable to 
		 * handle passed <code>args</code>, the next function will be executed
		 * and so on.
		 * @param {Object} skipValue If function returns this value, execute 
		 * next handler.
		 * @param {Array} args Arguments to pass to handler function
		 * @returns {Boolean} Whether any of registered handlers performed
		 * successfully  
		 */
		exec: function(skipValue, args) {
			args = args || [];
			var result = null;
			_.find(this.list(), function(h) {
				result = h.fn.apply(h, args);
				if (result !== skipValue)
					return true;
			});
			
			return result;
		}
	};
	
	return {
		/**
		 * Factory method that produces <code>HandlerList</code> instance
		 * @returns {HandlerList}
		 * @memberOf handlerList
		 */
		create: function() {
			return new HandlerList();
		}
	};
});/**
 * Helper class for convenient token iteration
 */
emmet.define('tokenIterator', function(require, _) {
	/**
	 * @type TokenIterator
	 * @param {Array} tokens
	 * @type TokenIterator
	 * @constructor
	 */
	function TokenIterator(tokens) {
		/** @type Array */
		this.tokens = tokens;
		this._position = 0;
		this.reset();
	}
	
	TokenIterator.prototype = {
		next: function() {
			if (this.hasNext()) {
				var token = this.tokens[++this._i];
				this._position = token.start;
				return token;
			}
			
			return null;
		},
		
		current: function() {
			return this.tokens[this._i];
		},
		
		position: function() {
			return this._position;
		},
		
		hasNext: function() {
			return this._i < this._il - 1;
		},
		
		reset: function() {
			this._i = -1;
			this._il = this.tokens.length;
		},
		
		item: function() {
			return this.tokens[this._i];
		},
		
		itemNext: function() {
			return this.tokens[this._i + 1];
		},
		
		itemPrev: function() {
			return this.tokens[this._i - 1];
		},
		
		nextUntil: function(type, callback) {
			var token;
			var test = _.isString(type) 
				? function(t){return t.type == type;} 
				: type;
			
			while (token = this.next()) {
				if (callback)
					callback.call(this, token);
				if (test.call(this, token))
					break;
			}
		}
	};
	
	return {
		create: function(tokens) {
			return new TokenIterator(tokens);
		}
	};
});/**
 * A trimmed version of CodeMirror's StringStream module for string parsing
 */
emmet.define('stringStream', function(require, _) {
	/**
	 * @type StringStream
	 * @constructor
	 * @param {String} string
	 */
	function StringStream(string) {
		this.pos = this.start = 0;
		this.string = string;
	}
	
	StringStream.prototype = {
		/**
		 * Returns true only if the stream is at the end of the line.
		 * @returns {Boolean}
		 */
		eol: function() {
			return this.pos >= this.string.length;
		},
		
		/**
		 * Returns true only if the stream is at the start of the line
		 * @returns {Boolean}
		 */
		sol: function() {
			return this.pos == 0;
		},
		
		/**
		 * Returns the next character in the stream without advancing it. 
		 * Will return <code>undefined</code> at the end of the line.
		 * @returns {String}
		 */
		peek: function() {
			return this.string.charAt(this.pos);
		},
		
		/**
		 * Returns the next character in the stream and advances it.
		 * Also returns <code>undefined</code> when no more characters are available.
		 * @returns {String}
		 */
		next: function() {
			if (this.pos < this.string.length)
				return this.string.charAt(this.pos++);
		},
		
		/**
		 * match can be a character, a regular expression, or a function that
		 * takes a character and returns a boolean. If the next character in the
		 * stream 'matches' the given argument, it is consumed and returned.
		 * Otherwise, undefined is returned.
		 * @param {Object} match
		 * @returns {String}
		 */
		eat: function(match) {
			var ch = this.string.charAt(this.pos), ok;
			if (typeof match == "string")
				ok = ch == match;
			else
				ok = ch && (match.test ? match.test(ch) : match(ch));
			
			if (ok) {
				++this.pos;
				return ch;
			}
		},
		
		/**
		 * Repeatedly calls <code>eat</code> with the given argument, until it
		 * fails. Returns <code>true</code> if any characters were eaten.
		 * @param {Object} match
		 * @returns {Boolean}
		 */
		eatWhile: function(match) {
			var start = this.pos;
			while (this.eat(match)) {}
			return this.pos > start;
		},
		
		/**
		 * Shortcut for <code>eatWhile</code> when matching white-space.
		 * @returns {Boolean}
		 */
		eatSpace: function() {
			var start = this.pos;
			while (/[\s\u00a0]/.test(this.string.charAt(this.pos)))
				++this.pos;
			return this.pos > start;
		},
		
		/**
		 * Moves the position to the end of the line.
		 */
		skipToEnd: function() {
			this.pos = this.string.length;
		},
		
		/**
		 * Skips to the next occurrence of the given character, if found on the
		 * current line (doesn't advance the stream if the character does not
		 * occur on the line). Returns true if the character was found.
		 * @param {String} ch
		 * @returns {Boolean}
		 */
		skipTo: function(ch) {
			var found = this.string.indexOf(ch, this.pos);
			if (found > -1) {
				this.pos = found;
				return true;
			}
		},
		
		/**
		 * Skips to <code>close</code> character which is pair to <code>open</code>
		 * character, considering possible pair nesting. This function is used
		 * to consume pair of characters, like opening and closing braces
		 * @param {String} open
		 * @param {String} close
		 * @returns {Boolean} Returns <code>true</code> if pair was successfully
		 * consumed
		 */
		skipToPair: function(open, close) {
			var braceCount = 0, ch;
			var pos = this.pos, len = this.string.length;
			while (pos < len) {
				ch = this.string.charAt(pos++);
				if (ch == open) {
					braceCount++;
				} else if (ch == close) {
					braceCount--;
					if (braceCount < 1) {
						this.pos = pos;
						return true;
					}
				}
			}
			
			return false;
		},
		
		/**
		 * Backs up the stream n characters. Backing it up further than the
		 * start of the current token will cause things to break, so be careful.
		 * @param {Number} n
		 */
		backUp : function(n) {
			this.pos -= n;
		},
		
		/**
		 * Act like a multi-character <code>eat</code>—if <code>consume</code> is true or
		 * not given—or a look-ahead that doesn't update the stream position—if
		 * it is false. <code>pattern</code> can be either a string or a
		 * regular expression starting with ^. When it is a string,
		 * <code>caseInsensitive</code> can be set to true to make the match
		 * case-insensitive. When successfully matching a regular expression,
		 * the returned value will be the array returned by <code>match</code>,
		 * in case you need to extract matched groups.
		 * 
		 * @param {RegExp} pattern
		 * @param {Boolean} consume
		 * @param {Boolean} caseInsensitive
		 * @returns
		 */
		match: function(pattern, consume, caseInsensitive) {
			if (typeof pattern == "string") {
				var cased = caseInsensitive
					? function(str) {return str.toLowerCase();}
					: function(str) {return str;};
				
				if (cased(this.string).indexOf(cased(pattern), this.pos) == this.pos) {
					if (consume !== false)
						this.pos += pattern.length;
					return true;
				}
			} else {
				var match = this.string.slice(this.pos).match(pattern);
				if (match && consume !== false)
					this.pos += match[0].length;
				return match;
			}
		},
		
		/**
		 * Get the string between the start of the current token and the 
		 * current stream position.
		 * @returns {String}
		 */
		current: function() {
			return this.string.slice(this.start, this.pos);
		}
	};
	
	return {
		create: function(string) {
			return new StringStream(string);
		}
	};
});/**
 * Parsed resources (snippets, abbreviations, variables, etc.) for Emmet.
 * Contains convenient method to get access for snippets with respect of 
 * inheritance. Also provides ability to store data in different vocabularies
 * ('system' and 'user') for fast and safe resource update
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.define('resources', function(require, _) {
	var VOC_SYSTEM = 'system';
	var VOC_USER = 'user';
	
	var cache = {};
		
	/** Regular expression for XML tag matching */
	var reTag = /^<(\w+\:?[\w\-]*)((?:\s+[\w\:\-]+\s*=\s*(['"]).*?\3)*)\s*(\/?)>/;
		
	var systemSettings = {};
	var userSettings = {};
	
	/** @type HandlerList List of registered abbreviation resolvers */
	var resolvers = require('handlerList').create();
	
	/**
	 * Normalizes caret plceholder in passed text: replaces | character with
	 * default caret placeholder
	 * @param {String} text
	 * @returns {String}
	 */
	function normalizeCaretPlaceholder(text) {
		var utils = require('utils');
		return utils.replaceUnescapedSymbol(text, '|', utils.getCaretPlaceholder());
	}
	
	function parseItem(name, value, type) {
		value = normalizeCaretPlaceholder(value);
		
		if (type == 'snippets') {
			return require('elements').create('snippet', value);
		}
		
		if (type == 'abbreviations') {
			return parseAbbreviation(name, value);
		}
	}
	
	/**
	 * Parses single abbreviation
	 * @param {String} key Abbreviation name
	 * @param {String} value Abbreviation value
	 * @return {Object}
	 */
	function parseAbbreviation(key, value) {
		key = require('utils').trim(key);
		var elements = require('elements');
		var m;
		if (m = reTag.exec(value)) {
			return elements.create('element', m[1], m[2], m[4] == '/');
		} else {
			// assume it's reference to another abbreviation
			return elements.create('reference', value);
		}
	}
	
	/**
	 * Normalizes snippet key name for better fuzzy search
	 * @param {String} str
	 * @returns {String}
	 */
	function normalizeName(str) {
		return str.replace(/:$/, '').replace(/:/g, '-');
	}
	
	return {
		/**
		 * Sets new unparsed data for specified settings vocabulary
		 * @param {Object} data
		 * @param {String} type Vocabulary type ('system' or 'user')
		 * @memberOf resources
		 */
		setVocabulary: function(data, type) {
			cache = {};
			if (type == VOC_SYSTEM)
				systemSettings = data;
			else
				userSettings = data;
		},
		
		/**
		 * Returns resource vocabulary by its name
		 * @param {String} name Vocabulary name ('system' or 'user')
		 * @return {Object}
		 */
		getVocabulary: function(name) {
			return name == VOC_SYSTEM ? systemSettings : userSettings;
		},
		
		/**
		 * Returns resource (abbreviation, snippet, etc.) matched for passed 
		 * abbreviation
		 * @param {TreeNode} node
		 * @param {String} syntax
		 * @returns {Object}
		 */
		getMatchedResource: function(node, syntax) {
			return resolvers.exec(null, _.toArray(arguments)) 
				|| this.findSnippet(syntax, node.name());
		},
		
		/**
		 * Returns variable value
		 * @return {String}
		 */
		getVariable: function(name) {
			return (this.getSection('variables') || {})[name];
		},
		
		/**
		 * Store runtime variable in user storage
		 * @param {String} name Variable name
		 * @param {String} value Variable value
		 */
		setVariable: function(name, value){
			var voc = this.getVocabulary('user') || {};
			if (!('variables' in voc))
				voc.variables = {};
				
			voc.variables[name] = value;
			this.setVocabulary(voc, 'user');
		},
		
		/**
		 * Check if there are resources for specified syntax
		 * @param {String} syntax
		 * @return {Boolean}
		 */
		hasSyntax: function(syntax) {
			return syntax in this.getVocabulary(VOC_USER) 
				|| syntax in this.getVocabulary(VOC_SYSTEM);
		},
		
		/**
		 * Registers new abbreviation resolver.
		 * @param {Function} fn Abbreviation resolver which will receive 
		 * abbreviation as first argument and should return parsed abbreviation
		 * object if abbreviation has handled successfully, <code>null</code>
		 * otherwise
		 * @param {Object} options Options list as described in 
		 * {@link HandlerList#add()} method
		 */
		addResolver: function(fn, options) {
			resolvers.add(fn, options);
		},
		
		removeResolver: function(fn) {
			resolvers.remove(fn);
		},
		
		/**
		 * Returns actual section data, merged from both
		 * system and user data
		 * @param {String} name Section name (syntax)
		 * @param {String} ...args Subsections
		 * @returns
		 */
		getSection: function(name) {
			if (!name)
				return null;
			
			if (!(name in cache)) {
				cache[name] = require('utils').deepMerge({}, systemSettings[name], userSettings[name]);
			}
			
			var data = cache[name], subsections = _.rest(arguments), key;
			while (data && (key = subsections.shift())) {
				if (key in data) {
					data = data[key];
				} else {
					return null;
				}
			}
			
			return data;
		},
		
		/**
		 * Recursively searches for a item inside top level sections (syntaxes)
		 * with respect of `extends` attribute
		 * @param {String} topSection Top section name (syntax)
		 * @param {String} subsection Inner section name
		 * @returns {Object}
		 */
		findItem: function(topSection, subsection) {
			var data = this.getSection(topSection);
			while (data) {
				if (subsection in data)
					return data[subsection];
				
				data = this.getSection(data['extends']);
			}
		},
		
		/**
		 * Recursively searches for a snippet definition inside syntax section.
		 * Definition is searched inside `snippets` and `abbreviations` 
		 * subsections  
		 * @param {String} syntax Top-level section name (syntax)
		 * @param {String} name Snippet name
		 * @returns {Object}
		 */
		findSnippet: function(syntax, name, memo) {
			if (!syntax || !name)
				return null;
			
			memo = memo || [];
			
			var names = [name];
			// create automatic aliases to properties with colons,
			// e.g. pos-a == pos:a
			if (~name.indexOf('-'))
				names.push(name.replace(/\-/g, ':'));
			
			var data = this.getSection(syntax), matchedItem = null;
			_.find(['snippets', 'abbreviations'], function(sectionName) {
				var data = this.getSection(syntax, sectionName);
				if (data) {
					return _.find(names, function(n) {
						if (data[n])
							return matchedItem = parseItem(n, data[n], sectionName);
					});
				}
			}, this);
			
			memo.push(syntax);
			if (!matchedItem && data['extends'] && !_.include(memo, data['extends'])) {
				// try to find item in parent syntax section
				return this.findSnippet(data['extends'], name, memo);
			}
			
			return matchedItem;
		},
		
		/**
		 * Performs fuzzy search of snippet definition
		 * @param {String} syntax Top-level section name (syntax)
		 * @param {String} name Snippet name
		 * @returns
		 */
		fuzzyFindSnippet: function(syntax, name, minScore) {
			minScore = minScore || 0.3;
			
			var payload = this.getAllSnippets(syntax);
			var sc = require('string-score');
			
			name = normalizeName(name);
			var scores = _.map(payload, function(value, key) {
				return {
					key: key,
					score: sc.score(value.nk, name, 0.1)
				};
			});
			
			var result = _.last(_.sortBy(scores, 'score'));
			if (result && result.score >= minScore) {
				var k = result.key;
				return payload[k].parsedValue;
//				return parseItem(k, payload[k].value, payload[k].type);
			}
		},
		
		/**
		 * Returns plain dictionary of all available abbreviations and snippets
		 * for specified syntax with respect of inheritance
		 * @param {String} syntax
		 * @returns {Object}
		 */
		getAllSnippets: function(syntax) {
			var cacheKey = 'all-' + syntax;
			if (!cache[cacheKey]) {
				var stack = [], sectionKey = syntax;
				var memo = [];
				
				do {
					var section = this.getSection(sectionKey);
					if (!section)
						break;
					
					_.each(['snippets', 'abbreviations'], function(sectionName) {
						var stackItem = {};
						_.each(section[sectionName] || null, function(v, k) {
							stackItem[k] = {
								nk: normalizeName(k),
								value: v,
								parsedValue: parseItem(k, v, sectionName),
								type: sectionName
							};
						});
						
						stack.push(stackItem);
					});
					
					memo.push(sectionKey);
					sectionKey = section['extends'];
				} while (sectionKey && !_.include(memo, sectionKey));
				
				
				cache[cacheKey] = _.extend.apply(_, stack.reverse());
			}
			
			return cache[cacheKey];
		}
	};
});/**
 * Module describes and performs Emmet actions. The actions themselves are
 * defined in <i>actions</i> folder
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.define('actions', function(require, _, zc) {
	var actions = {};
	
	/**
	 * “Humanizes” action name, makes it more readable for people
	 * @param {String} name Action name (like 'expand_abbreviation')
	 * @return Humanized name (like 'Expand Abbreviation')
	 */
	function humanizeActionName(name) {
		return require('utils').trim(name.charAt(0).toUpperCase() 
			+ name.substring(1).replace(/_[a-z]/g, function(str) {
				return ' ' + str.charAt(1).toUpperCase();
			}));
	}
	
	return {
		/**
		 * Registers new action
		 * @param {String} name Action name
		 * @param {Function} fn Action function
		 * @param {Object} options Custom action options:<br>
		 * <b>label</b> : (<code>String</code>) – Human-readable action name. 
		 * May contain '/' symbols as submenu separators<br>
		 * <b>hidden</b> : (<code>Boolean</code>) – Indicates whether action
		 * should be displayed in menu (<code>getMenu()</code> method)
		 * 
		 * @memberOf actions
		 */
		add: function(name, fn, options) {
			name = name.toLowerCase();
			options = options || {};
			if (!options.label) {
				options.label = humanizeActionName(name);
			}
			
			actions[name] = {
				name: name,
				fn: fn,
				options: options
			};
		},
		
		/**
		 * Returns action object
		 * @param {String} name Action name
		 * @returns {Object}
		 */
		get: function(name) {
			return actions[name.toLowerCase()];
		},
		
		/**
		 * Runs Emmet action. For list of available actions and their
		 * arguments see <i>actions</i> folder.
		 * @param {String} name Action name 
		 * @param {Array} args Additional arguments. It may be array of arguments
		 * or inline arguments. The first argument should be <code>IEmmetEditor</code> instance
		 * @returns {Boolean} Status of performed operation, <code>true</code>
		 * means action was performed successfully.
		 * @example
		 * emmet.require('actions').run('expand_abbreviation', editor);  
		 * emmet.require('actions').run('wrap_with_abbreviation', [editor, 'div']);  
		 */
		run: function(name, args) {
			if (!_.isArray(args)) {
				args = _.rest(arguments);
			}
			
			var action = this.get(name);
			if (action) {
				return action.fn.apply(emmet, args);
			} else {
				emmet.log('Action "%s" is not defined', name);
				return false;
			}
		},
		
		/**
		 * Returns all registered actions as object
		 * @returns {Object}
		 */
		getAll: function() {
			return actions;
		},
		
		/**
		 * Returns all registered actions as array
		 * @returns {Array}
		 */
		getList: function() {
			return _.values(this.getAll());
		},
		
		/**
		 * Returns actions list as structured menu. If action has <i>label</i>,
		 * it will be splitted by '/' symbol into submenus (for example: 
		 * CSS/Reflect Value) and grouped with other items
		 * @param {Array} skipActions List of action identifiers that should be 
		 * skipped from menu
		 * @returns {Array}
		 */
		getMenu: function(skipActions) {
			var result = [];
			skipActions = skipActions || [];
			_.each(this.getList(), function(action) {
				if (action.options.hidden || _.include(skipActions, action.name))
					return;
				
				var actionName = humanizeActionName(action.name);
				var ctx = result;
				if (action.options.label) {
					var parts = action.options.label.split('/');
					actionName = parts.pop();
					
					// create submenus, if needed
					var menuName, submenu;
					while (menuName = parts.shift()) {
						submenu = _.find(ctx, function(item) {
							return item.type == 'submenu' && item.name == menuName;
						});
						
						if (!submenu) {
							submenu = {
								name: menuName,
								type: 'submenu',
								items: []
							};
							ctx.push(submenu);
						}
						
						ctx = submenu.items;
					}
				}
				
				ctx.push({
					type: 'action',
					name: action.name,
					label: actionName
				});
			});
			
			return result;
		},

		/**
		 * Returns action name associated with menu item title
		 * @param {String} title
		 * @returns {String}
		 */
		getActionNameForMenuTitle: function(title, menu) {
			var item = null;
			_.find(menu || this.getMenu(), function(val) {
				if (val.type == 'action') {
					if (val.label == title || val.name == title) {
						return item = val.name;
					}
				} else {
					return item = this.getActionNameForMenuTitle(title, val.items);
				}
			}, this);
			
			return item || null;
		}
	};
});/**
 * Output profile module.
 * Profile defines how XHTML output data should look like
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.define('profile', function(require, _) {
	var profiles = {};
	
	var defaultProfile = {
		tag_case: 'asis',
		attr_case: 'asis',
		attr_quotes: 'double',
		
		// each tag on new line
		tag_nl: 'decide',
		
		// with tag_nl === true, defines if leaf node (e.g. node with no children)
		// should have formatted line breaks
		tag_nl_leaf: false,
		
		place_cursor: true,
		
		// indent tags
		indent: true,
		
		// how many inline elements should be to force line break 
		// (set to 0 to disable)
		inline_break: 3,
		
		// use self-closing style for writing empty elements, e.g. <br /> or <br>
		self_closing_tag: 'xhtml',
		
		// Profile-level output filters, re-defines syntax filters 
		filters: ''
	};
	
	/**
	 * @constructor
	 * @type OutputProfile
	 * @param {Object} options
	 */
	function OutputProfile(options) {
		_.extend(this, defaultProfile, options);
	}
	
	OutputProfile.prototype = {
		/**
		 * Transforms tag name case depending on current profile settings
		 * @param {String} name String to transform
		 * @returns {String}
		 */
		tagName: function(name) {
			return stringCase(name, this.tag_case);
		},
		
		/**
		 * Transforms attribute name case depending on current profile settings 
		 * @param {String} name String to transform
		 * @returns {String}
		 */
		attributeName: function(name) {
			return stringCase(name, this.attr_case);
		},
		
		/**
		 * Returns quote character for current profile
		 * @returns {String}
		 */
		attributeQuote: function() {
			return this.attr_quotes == 'single' ? "'" : '"';
		},
		
		/**
		 * Returns self-closing tag symbol for current profile
		 * @param {String} param
		 * @returns {String}
		 */
		selfClosing: function(param) {
			if (this.self_closing_tag == 'xhtml')
				return ' /';
			
			if (this.self_closing_tag === true)
				return '/';
			
			return '';
		},
		
		/**
		 * Returns cursor token based on current profile settings
		 * @returns {String}
		 */
		cursor: function() {
			return this.place_cursor ? require('utils').getCaretPlaceholder() : '';
		}
	};
	
	/**
	 * Helper function that converts string case depending on 
	 * <code>caseValue</code> 
	 * @param {String} str String to transform
	 * @param {String} caseValue Case value: can be <i>lower</i>, 
	 * <i>upper</i> and <i>leave</i>
	 * @returns {String}
	 */
	function stringCase(str, caseValue) {
		switch (String(caseValue || '').toLowerCase()) {
			case 'lower':
				return str.toLowerCase();
			case 'upper':
				return str.toUpperCase();
		}
		
		return str;
	}
	
	/**
	 * Creates new output profile
	 * @param {String} name Profile name
	 * @param {Object} options Profile options
	 */
	function createProfile(name, options) {
		return profiles[name.toLowerCase()] = new OutputProfile(options);
	}
	
	function createDefaultProfiles() {
		createProfile('xhtml');
		createProfile('html', {self_closing_tag: false});
		createProfile('xml', {self_closing_tag: true, tag_nl: true});
		createProfile('plain', {tag_nl: false, indent: false, place_cursor: false});
		createProfile('line', {tag_nl: false, indent: false});
	}
	
	createDefaultProfiles();
	
	return  {
		/**
		 * Creates new output profile and adds it into internal dictionary
		 * @param {String} name Profile name
		 * @param {Object} options Profile options
		 * @memberOf emmet.profile
		 * @returns {Object} New profile
		 */
		create: function(name, options) {
			if (arguments.length == 2)
				return createProfile(name, options);
			else
				// create profile object only
				return new OutputProfile(_.defaults(name || {}, defaultProfile));
		},
		
		/**
		 * Returns profile by its name. If profile wasn't found, returns
		 * 'plain' profile
		 * @param {String} name Profile name. Might be profile itself
		 * @param {String} syntax. Optional. Current editor syntax. If defined,
		 * profile is searched in resources first, then in predefined profiles
		 * @returns {Object}
		 */
		get: function(name, syntax) {
			if (!name && syntax) {
				// search in user resources first
				var profile = require('resources').findItem(syntax, 'profile');
				if (profile) {
					name = profile;
				}
			}
			
			if (!name) {
				return profiles.plain;
			}
			
			if (name instanceof OutputProfile) {
				return name;
			}
			
			if (_.isString(name) && name.toLowerCase() in profiles) {
				return profiles[name.toLowerCase()];
			}
			
			return this.create(name);
		},
		
		/**
		 * Deletes profile with specified name
		 * @param {String} name Profile name
		 */
		remove: function(name) {
			name = (name || '').toLowerCase();
			if (name in profiles)
				delete profiles[name];
		},
		
		/**
		 * Resets all user-defined profiles
		 */
		reset: function() {
			profiles = {};
			createDefaultProfiles();
		},
		
		/**
		 * Helper function that converts string case depending on 
		 * <code>caseValue</code> 
		 * @param {String} str String to transform
		 * @param {String} caseValue Case value: can be <i>lower</i>, 
		 * <i>upper</i> and <i>leave</i>
		 * @returns {String}
		 */
		stringCase: stringCase
	};
});/**
 * Utility module used to prepare text for pasting into back-end editor
 * @param {Function} require
 * @param {Underscore} _
 * @author Sergey Chikuyonok (serge.che@gmail.com) <http://chikuyonok.ru>
 */
emmet.define('editorUtils', function(require, _) {
	return  {
		/**
		 * Check if cursor is placed inside XHTML tag
		 * @param {String} html Contents of the document
		 * @param {Number} caretPos Current caret position inside tag
		 * @return {Boolean}
		 */
		isInsideTag: function(html, caretPos) {
			var reTag = /^<\/?\w[\w\:\-]*.*?>/;
			
			// search left to find opening brace
			var pos = caretPos;
			while (pos > -1) {
				if (html.charAt(pos) == '<') 
					break;
				pos--;
			}
			
			if (pos != -1) {
				var m = reTag.exec(html.substring(pos));
				if (m && caretPos > pos && caretPos < pos + m[0].length)
					return true;
			}
			
			return false;
		},
		
		/**
		 * Sanitizes incoming editor data and provides default values for
		 * output-specific info
		 * @param {IEmmetEditor} editor
		 * @param {String} syntax
		 * @param {String} profile
		 */
		outputInfo: function(editor, syntax, profile) {
			// most of this code makes sense for Java/Rhino environment
			// because string that comes from Java are not actually JS string
			// but Java String object so the have to be explicitly converted
			// to native string
			profile = profile || editor.getProfileName();
			return  {
				/** @memberOf outputInfo */
				syntax: String(syntax || editor.getSyntax()),
				profile: profile ? String(profile) : null,
				content: String(editor.getContent())
			};
		},
		
		/**
		 * Unindent content, thus preparing text for tag wrapping
		 * @param {IEmmetEditor} editor Editor instance
		 * @param {String} text
		 * @return {String}
		 */
		unindent: function(editor, text) {
			return require('utils').unindentString(text, this.getCurrentLinePadding(editor));
		},
		
		/**
		 * Returns padding of current editor's line
		 * @param {IEmmetEditor} Editor instance
		 * @return {String}
		 */
		getCurrentLinePadding: function(editor) {
			return require('utils').getLinePadding(editor.getCurrentLine());
		}
	};
});
/**
 * Utility methods for Emmet actions
 * @param {Function} require
 * @param {Underscore} _
 * @author Sergey Chikuyonok (serge.che@gmail.com) <http://chikuyonok.ru>
 */
emmet.define('actionUtils', function(require, _) {
	return {
		mimeTypes: {
			'gif' : 'image/gif',
			'png' : 'image/png',
			'jpg' : 'image/jpeg',
			'jpeg': 'image/jpeg',
			'svg' : 'image/svg+xml',
			'html': 'text/html',
			'htm' : 'text/html'
		},
		
		/**
		 * Extracts abbreviations from text stream, starting from the end
		 * @param {String} str
		 * @return {String} Abbreviation or empty string
		 * @memberOf emmet.actionUtils
		 */
		extractAbbreviation: function(str) {
			var curOffset = str.length;
			var startIndex = -1;
			var groupCount = 0;
			var braceCount = 0;
			var textCount = 0;
			
			var utils = require('utils');
			var parser = require('abbreviationParser');
			
			while (true) {
				curOffset--;
				if (curOffset < 0) {
					// moved to the beginning of the line
					startIndex = 0;
					break;
				}
				
				var ch = str.charAt(curOffset);
				
				if (ch == ']') {
					braceCount++;
				} else if (ch == '[') {
					if (!braceCount) { // unexpected brace
						startIndex = curOffset + 1;
						break;
					}
					braceCount--;
				} else if (ch == '}') {
					textCount++;
				} else if (ch == '{') {
					if (!textCount) { // unexpected brace
						startIndex = curOffset + 1;
						break;
					}
					textCount--;
				} else if (ch == ')') {
					groupCount++;
				} else if (ch == '(') {
					if (!groupCount) { // unexpected brace
						startIndex = curOffset + 1;
						break;
					}
					groupCount--;
				} else {
					if (braceCount || textCount) 
						// respect all characters inside attribute sets or text nodes
						continue;
					else if (!parser.isAllowedChar(ch) || (ch == '>' && utils.endsWithTag(str.substring(0, curOffset + 1)))) {
						// found stop symbol
						startIndex = curOffset + 1;
						break;
					}
				}
			}
			
			if (startIndex != -1 && !textCount && !braceCount && !groupCount) 
				// found something, remove some invalid symbols from the 
				// beginning and return abbreviation
				return str.substring(startIndex).replace(/^[\*\+\>\^]+/, '');
			else
				return '';
		},
		
		/**
		 * Gets image size from image byte stream.
		 * @author http://romeda.org/rePublish/
		 * @param {String} stream Image byte stream (use <code>IEmmetFile.read()</code>)
		 * @return {Object} Object with <code>width</code> and <code>height</code> properties
		 */
		getImageSize: function(stream) {
			var pngMagicNum = "\211PNG\r\n\032\n",
				jpgMagicNum = "\377\330",
				gifMagicNum = "GIF8",
				nextByte = function() {
					return stream.charCodeAt(pos++);
				};
		
			if (stream.substr(0, 8) === pngMagicNum) {
				// PNG. Easy peasy.
				var pos = stream.indexOf('IHDR') + 4;
			
				return { width:  (nextByte() << 24) | (nextByte() << 16) |
								 (nextByte() <<  8) | nextByte(),
						 height: (nextByte() << 24) | (nextByte() << 16) |
								 (nextByte() <<  8) | nextByte() };
			
			} else if (stream.substr(0, 4) === gifMagicNum) {
				pos = 6;
			
				return {
					width:  nextByte() | (nextByte() << 8),
					height: nextByte() | (nextByte() << 8)
				};
			
			} else if (stream.substr(0, 2) === jpgMagicNum) {
				pos = 2;
			
				var l = stream.length;
				while (pos < l) {
					if (nextByte() != 0xFF) return;
				
					var marker = nextByte();
					if (marker == 0xDA) break;
				
					var size = (nextByte() << 8) | nextByte();
				
					if (marker >= 0xC0 && marker <= 0xCF && !(marker & 0x4) && !(marker & 0x8)) {
						pos += 1;
						return { height:  (nextByte() << 8) | nextByte(),
								 width: (nextByte() << 8) | nextByte() };
				
					} else {
						pos += size - 2;
					}
				}
			}
		},
		
		/**
		 * Captures context XHTML element from editor under current caret position.
		 * This node can be used as a helper for abbreviation extraction
		 * @param {IEmmetEditor} editor
		 * @returns {Object}
		 */
		captureContext: function(editor) {
			var allowedSyntaxes = {'html': 1, 'xml': 1, 'xsl': 1};
			var syntax = String(editor.getSyntax());
			if (syntax in allowedSyntaxes) {
				var tags = require('html_matcher').getTags(
						String(editor.getContent()), 
						editor.getCaretPos(), 
						String(editor.getProfileName()));
				
				if (tags && tags[0] && tags[0].type == 'tag') {
					var reAttr = /([\w\-:]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g;
					var startTag = tags[0];
					var tagAttrs = startTag.full_tag.replace(/^<[\w\-\:]+/, '');
					var contextNode = {
						name: startTag.name,
						attributes: []
					};
					
					// parse attributes
					var m;
					while (m = reAttr.exec(tagAttrs)) {
						contextNode.attributes.push({
							name: m[1],
							value: m[2]
						});
					}
					
					return contextNode;
				}
			}
			
			return null;
		},
		
		/**
		 * Find expression bounds in current editor at caret position. 
		 * On each character a <code>fn</code> function will be called and must 
		 * return <code>true</code> if current character meets requirements, 
		 * <code>false</code> otherwise
		 * @param {IEmmetEditor} editor
		 * @param {Function} fn Function to test each character of expression
		 * @return {Range}
		 */
		findExpressionBounds: function(editor, fn) {
			var content = String(editor.getContent());
			var il = content.length;
			var exprStart = editor.getCaretPos() - 1;
			var exprEnd = exprStart + 1;
				
			// start by searching left
			while (exprStart >= 0 && fn(content.charAt(exprStart), exprStart, content)) exprStart--;
			
			// then search right
			while (exprEnd < il && fn(content.charAt(exprEnd), exprEnd, content)) exprEnd++;
			
			if (exprEnd > exprStart) {
				return require('range').create([++exprStart, exprEnd]);
			}
		},
		
		/**
		 * @param {IEmmetEditor} editor
		 * @param {Object} data
		 * @returns {Boolean}
		 */
		compoundUpdate: function(editor, data) {
			if (data) {
				var sel = editor.getSelectionRange();
				editor.replaceContent(data.data, data.start, data.end, true);
				editor.createSelection(data.caret, data.caret + sel.end - sel.start);
				return true;
			}
			
			return false;
		},
		
		/**
		 * Common syntax detection method for editors that doesn’t provide any
		 * info about current syntax scope. 
		 * @param {IEmmetEditor} editor Current editor
		 * @param {String} hint Any syntax hint that editor can provide 
		 * for syntax detection. Default is 'html'
		 * @returns {String} 
		 */
		detectSyntax: function(editor, hint) {
			var caretPos = editor.getCaretPos();
			var syntax = hint || 'html';
			
			if (!require('resources').hasSyntax(syntax))
				syntax = 'html';
			
			if (syntax == 'html') {
				// are we inside <style> tag?
				var pair = require('html_matcher').getTags(editor.getContent(), caretPos);
				if (pair && pair[0] && pair[0].type == 'tag' && pair[0].name.toLowerCase() == 'style') {
					// check that we're actually inside the tag
					if (pair[0].end <= caretPos && pair[1].start >= caretPos)
						syntax = 'css';
				}
			}
			
            if (syntax == 'html') {
            	// are we inside style attribute?
                var tree = require('xmlEditTree').parseFromPosition(editor.getContent(), caretPos, true);
                if (tree) {
                    var attr = tree.itemFromPosition(caretPos, true);
                    if (attr && attr.name().toLowerCase() == 'style') {
                        var range = attr.valueRange(true);
                        if (range.start <= caretPos && range.end >= caretPos)
                            syntax = 'css';
                    }
                }
            }
			
			return syntax;
		},
		
		/**
		 * Common method for detecting output profile
		 * @param {IEmmetEditor} editor
		 * @returns {String}
		 */
		detectProfile: function(editor) {
			switch(editor.getSyntax()) {
				 case 'xml':
				 case 'xsl':
				 	return 'xml';
				 case 'html':
				 	var profile = require('resources').getVariable('profile');
				 	if (!profile) { // no forced profile, guess from content
					 	// html or xhtml?
				 		profile = this.isXHTML(editor) ? 'xhtml': 'html';
				 	}

				 	return profile;
			}

			return 'xhtml';
		},
		
		/**
		 * Tries to detect if current document is XHTML one.
		 * @param {IEmmetEditor} editor
		 * @returns {Boolean}
		 */
		isXHTML: function(editor) {
			return editor.getContent().search(/<!DOCTYPE[^>]+XHTML/i) != -1;
		}
	};
});/**
 * Utility functions to work with <code>AbbreviationNode</code> as HTML element
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.define('abbreviationUtils', function(require, _) {
	return {
		/**
		 * Check if passed abbreviation node has matched snippet resource
		 * @param {AbbreviationNode} node
		 * @returns {Boolean}
		 * @memberOf abbreviationUtils
		 */
		isSnippet: function(node) {
			return require('elements').is(node.matchedResource(), 'snippet');
		},
		
		/**
		 * Test if passed node is unary (no closing tag)
		 * @param {AbbreviationNode} node
		 * @return {Boolean}
		 */
		isUnary: function(node) {
			var r = node.matchedResource();
			if (node.children.length || this.isSnippet(node))
				return false;
			
			return r && r.is_empty || require('tagName').isEmptyElement(node.name());
		},
		
		/**
		 * Test if passed node is inline-level (like &lt;strong&gt;, &lt;img&gt;)
		 * @param {AbbreviationNode} node
		 * @return {Boolean}
		 */
		isInline: function(node) {
			return node.isTextNode() 
				|| !node.name() 
				|| require('tagName').isInlineLevel(node.name());
		},
		
		/**
		 * Test if passed node is block-level
		 * @param {AbbreviationNode} node
		 * @return {Boolean}
		 */
		isBlock: function(node) {
			return require('elements').is(node.matchedResource(), 'snippet') 
				|| !this.isInline(node);
		},
		
		/**
		 * This function tests if passed node content contains HTML tags. 
		 * This function is mostly used for output formatting
		 * @param {AbbreviationNode} node
		 * @returns {Boolean}
		 */
		hasTagsInContent: function(node) {
			return require('utils').matchesTag(node.content);
		},
		
		/**
		 * Test if current element contains block-level children
		 * @param {AbbreviationNode} node
		 * @return {Boolean}
		 */
		hasBlockChildren: function(node) {
			return (this.hasTagsInContent(node) && this.isBlock(node)) 
				|| _.any(node.children, function(child) {
					return this.isBlock(child);
				}, this);
		},
		
		/**
		 * Utility function that inserts content instead of <code>${child}</code>
		 * variables on <code>text</code>
		 * @param {String} text Text where child content should be inserted
		 * @param {String} childContent Content to insert
		 * @param {Object} options
		 * @returns {String
		 */
		insertChildContent: function(text, childContent, options) {
			options = _.extend({
				keepVariable: true,
				appendIfNoChild: true
			}, options || {});
			
			var childVariableReplaced = false;
			var utils = require('utils');
			text = utils.replaceVariables(text, function(variable, name, data) {
				var output = variable;
				if (name == 'child') {
					// add correct indentation
					output = utils.padString(childContent, utils.getLinePaddingFromPosition(text, data.start));
					childVariableReplaced = true;
					if (options.keepVariable)
						output += variable;
				}
				
				return output;
			});
			
			if (!childVariableReplaced && options.appendIfNoChild) {
				text += childContent;
			}
			
			return text;
		}
	};
});/**
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 */
emmet.define('base64', function(require, _) {
	var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
	
	return {
		/**
		 * Encodes data using base64 algorithm
		 * @author Tyler Akins (http://rumkin.com)
		 * @param {String} input
		 * @returns {String}
		 * @memberOf emmet.base64
		 */
		encode : function(input) {
			var output = [];
			var chr1, chr2, chr3, enc1, enc2, enc3, enc4, cdp1, cdp2, cdp3;
			var i = 0, il = input.length, b64 = chars;

			while (i < il) {

				cdp1 = input.charCodeAt(i++);
				cdp2 = input.charCodeAt(i++);
				cdp3 = input.charCodeAt(i++);

				chr1 = cdp1 & 0xff;
				chr2 = cdp2 & 0xff;
				chr3 = cdp3 & 0xff;

				enc1 = chr1 >> 2;
				enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
				enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
				enc4 = chr3 & 63;

				if (isNaN(cdp2)) {
					enc3 = enc4 = 64;
				} else if (isNaN(cdp3)) {
					enc4 = 64;
				}

				output.push(b64.charAt(enc1) + b64.charAt(enc2) + b64.charAt(enc3) + b64.charAt(enc4));
			}

			return output.join('');
		},

		/**
		 * Decodes string using MIME base64 algorithm
		 * 
		 * @author Tyler Akins (http://rumkin.com)
		 * @param {String} data
		 * @return {String}
		 */
		decode : function(data) {
			var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, tmpArr = [];
			var b64 = chars, il = data.length;

			if (!data) {
				return data;
			}

			data += '';

			do { // unpack four hexets into three octets using index points in b64
				h1 = b64.indexOf(data.charAt(i++));
				h2 = b64.indexOf(data.charAt(i++));
				h3 = b64.indexOf(data.charAt(i++));
				h4 = b64.indexOf(data.charAt(i++));

				bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;

				o1 = bits >> 16 & 0xff;
				o2 = bits >> 8 & 0xff;
				o3 = bits & 0xff;

				if (h3 == 64) {
					tmpArr[ac++] = String.fromCharCode(o1);
				} else if (h4 == 64) {
					tmpArr[ac++] = String.fromCharCode(o1, o2);
				} else {
					tmpArr[ac++] = String.fromCharCode(o1, o2, o3);
				}
			} while (i < il);

			return tmpArr.join('');
		}
	};
});/**
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 */(function(){
	// Regular Expressions for parsing tags and attributes
	var start_tag = /^<([\w\:\-]+)((?:\s+[\w\-:]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
		end_tag = /^<\/([\w\:\-]+)[^>]*>/,
		attr = /([\w\-:]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g;
		
	// Empty Elements - HTML 4.01
	var empty = makeMap("area,base,basefont,br,col,frame,hr,img,input,isindex,link,meta,param,embed");

	// Block Elements - HTML 4.01
	var block = makeMap("address,applet,blockquote,button,center,dd,dir,div,dl,dt,fieldset,form,frameset,hr,iframe,isindex,li,map,menu,noframes,noscript,object,ol,p,pre,script,table,tbody,td,tfoot,th,thead,tr,ul");

	// Inline Elements - HTML 4.01
	var inline = makeMap("a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,select,small,span,strike,strong,sub,sup,textarea,tt,u,var");

	// Elements that you can, intentionally, leave open
	// (and which close themselves)
	var close_self = makeMap("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr");
	
	/** Current matching mode */
	var cur_mode = 'xhtml';
	
	/** Last matched HTML pair */
	var last_match = {
		opening_tag: null, // tag() or comment() object
		closing_tag: null, // tag() or comment() object
		start_ix: -1,
		end_ix: -1
	};
	
	function setMode(new_mode) {
		if (!new_mode || new_mode != 'html')
			new_mode = 'xhtml';
			
		cur_mode = new_mode;
	}
	
	function tag(match, ix) {
		var name = match[1].toLowerCase();
		return  {
			name: name,
			full_tag: match[0],
			start: ix,
			end: ix + match[0].length,
			unary: Boolean(match[3]) || (name in empty && cur_mode == 'html'),
			has_close: Boolean(match[3]),
			type: 'tag',
			close_self: (name in close_self && cur_mode == 'html')
		};
	}
	
	function comment(start, end) {
		return {
			start: start,
			end: end,
			type: 'comment'
		};
	}
	
	function makeMap(str){
		var obj = {}, items = str.split(",");
		for ( var i = 0; i < items.length; i++ )
			obj[ items[i] ] = true;
		return obj;
	}
	
	/**
	 * Makes selection ranges for matched tag pair
	 * @param {tag} opening_tag
	 * @param {tag} closing_tag
	 * @param {Number} ix
	 */
	function makeRange(opening_tag, closing_tag, ix) {
		ix = ix || 0;
		
		var start_ix = -1, 
			end_ix = -1;
		
		if (opening_tag && !closing_tag) { // unary element
			start_ix = opening_tag.start;
			end_ix = opening_tag.end;
		} else if (opening_tag && closing_tag) { // complete element
			if (
				(opening_tag.start < ix && opening_tag.end > ix) || 
				(closing_tag.start <= ix && closing_tag.end > ix)
			) {
				start_ix = opening_tag.start;
				end_ix = closing_tag.end;
			} else {
				start_ix = opening_tag.end;
				end_ix = closing_tag.start;
			}
		}
		
		return [start_ix, end_ix];
	}
	
	/**
	 * Save matched tag for later use and return found indexes
	 * @param {tag} opening_tag
	 * @param {tag} closing_tag
	 * @param {Number} ix
	 * @return {Array}
	 */
	function saveMatch(opening_tag, closing_tag, ix) {
		ix = ix || 0;
		last_match.opening_tag = opening_tag; 
		last_match.closing_tag = closing_tag;
		
		var range = makeRange(opening_tag, closing_tag, ix);
		last_match.start_ix = range[0];
		last_match.end_ix = range[1];
		
		return last_match.start_ix != -1 ? [last_match.start_ix, last_match.end_ix] : null;
	}
	
	/**
	 * Handle unary tag: find closing tag if needed
	 * @param {String} text
	 * @param {Number} ix
	 * @param {tag} open_tag
	 * @return {tag|null} Closing tag (or null if not found) 
	 */
	function handleUnaryTag(text, ix, open_tag) {
		if (open_tag.has_close)
			return null;
		else {
			// TODO finish this method
		}
	}
	
	/**
	 * Search for matching tags in <code>html</code>, starting from 
	 * <code>start_ix</code> position
	 * @param {String} html Code to search
	 * @param {Number} start_ix Character index where to start searching pair 
	 * (commonly, current caret position)
	 * @param {Function} action Function that creates selection range
	 * @return {Array}
	 */
	function findPair(html, start_ix, mode, action) {
		action = action || makeRange;
		setMode(mode);
		
		var forward_stack = [],
			backward_stack = [],
			/** @type {tag()} */
			opening_tag = null,
			/** @type {tag()} */
			closing_tag = null,
			html_len = html.length,
			m,
			ix,
			tmp_tag;
			
		forward_stack.last = backward_stack.last = function() {
			return this[this.length - 1];
		};
		
		function hasMatch(str, start) {
			if (arguments.length == 1)
				start = ix;
			return html.substr(start, str.length) == str;
		}
		
		function searchCommentStart(from) {
			while (from--) {
				if (html.charAt(from) == '<' && hasMatch('<!--', from))
					break;
			}
			
			return from;
		}
		
		// find opening tag
		ix = start_ix;
		while (ix-- && ix >= 0) {
			var ch = html.charAt(ix);
			if (ch == '<') {
				var check_str = html.substring(ix, html_len);
				
				if ( (m = check_str.match(end_tag)) ) { // found closing tag
					tmp_tag = tag(m, ix);
					if (tmp_tag.start < start_ix && tmp_tag.end > start_ix) // direct hit on searched closing tag
						closing_tag = tmp_tag;
					else
						backward_stack.push(tmp_tag);
				} else if ( (m = check_str.match(start_tag)) ) { // found opening tag
					tmp_tag = tag(m, ix);
					
					if (tmp_tag.unary) {
						if (tmp_tag.start < start_ix && tmp_tag.end > start_ix) // exact match
							// TODO handle unary tag 
							return action(tmp_tag, null, start_ix);
					} else if (backward_stack.last() && backward_stack.last().name == tmp_tag.name) {
						backward_stack.pop();
					} else { // found nearest unclosed tag
						opening_tag = tmp_tag;
						break;
					}
				} else if (check_str.indexOf('<!--') == 0) { // found comment start
					var end_ix = check_str.search('-->') + ix + 3;
					if (ix < start_ix && end_ix >= start_ix)
						return action( comment(ix, end_ix) );
				}
			} else if (ch == '-' && hasMatch('-->')) { // found comment end
				// search left until comment start is reached
				ix = searchCommentStart(ix);
			}
		}
		
		if (!opening_tag)
			return action(null);
		
		// find closing tag
		if (!closing_tag) {
			for (ix = start_ix; ix < html_len; ix++) {
				var ch = html.charAt(ix);
				if (ch == '<') {
					var check_str = html.substring(ix, html_len);
					
					if ( (m = check_str.match(start_tag)) ) { // found opening tag
						tmp_tag = tag(m, ix);
						if (!tmp_tag.unary)
							forward_stack.push( tmp_tag );
					} else if ( (m = check_str.match(end_tag)) ) { // found closing tag
						var tmp_tag = tag(m, ix);
						if (forward_stack.last() && forward_stack.last().name == tmp_tag.name)
							forward_stack.pop();
						else { // found matched closing tag
							closing_tag = tmp_tag;
							break;
						}
					} else if (hasMatch('<!--')) { // found comment
						ix += check_str.search('-->') + 2;
					}
				} else if (ch == '-' && hasMatch('-->')) {
					// looks like cursor was inside comment with invalid HTML
					if (!forward_stack.last() || forward_stack.last().type != 'comment') {
						var end_ix = ix + 3;
						return action(comment( searchCommentStart(ix), end_ix ));
					}
				}
			}
		}
		
		return action(opening_tag, closing_tag, start_ix);
	}
	
	/**
	 * Search for matching tags in <code>html</code>, starting 
	 * from <code>start_ix</code> position. The result is automatically saved in 
	 * <code>last_match</code> property
	 * 
	 * @return {Array|null}
	 */
	var HTMLPairMatcher = function(/* String */ html, /* Number */ start_ix, /*  */ mode){
		return findPair(html, start_ix, mode, saveMatch);
	};
	
	HTMLPairMatcher.start_tag = start_tag;
	HTMLPairMatcher.end_tag = end_tag;
	
	/**
	 * Search for matching tags in <code>html</code>, starting from 
	 * <code>start_ix</code> position. The difference between 
	 * <code>HTMLPairMatcher</code> function itself is that <code>find</code> 
	 * method doesn't save matched result in <code>last_match</code> property.
	 * This method is generally used for lookups 
	 */
	HTMLPairMatcher.find = function(html, start_ix, mode) {
		return findPair(html, start_ix, mode);
	};
	
	/**
	 * Search for matching tags in <code>html</code>, starting from 
	 * <code>start_ix</code> position. The difference between 
	 * <code>HTMLPairMatcher</code> function itself is that <code>getTags</code> 
	 * method doesn't save matched result in <code>last_match</code> property 
	 * and returns array of opening and closing tags
	 * This method is generally used for lookups 
	 */
	HTMLPairMatcher.getTags = function(html, start_ix, mode) {
		return findPair(html, start_ix, mode, function(opening_tag, closing_tag){
			return [opening_tag, closing_tag];
		});
	};
	
	HTMLPairMatcher.last_match = last_match;
	
	try {
		emmet.define('html_matcher', function() {
			return HTMLPairMatcher;
		});
	} catch(e){}
	
})();/**
 * Utility module for handling tabstops tokens generated by Emmet's 
 * "Expand Abbreviation" action. The main <code>extract</code> method will take
 * raw text (for example: <i>${0} some ${1:text}</i>), find all tabstops 
 * occurrences, replace them with tokens suitable for your editor of choice and 
 * return object with processed text and list of found tabstops and their ranges.
 * For sake of portability (Objective-C/Java) the tabstops list is a plain 
 * sorted array with plain objects.
 * 
 * Placeholders with the same are meant to be <i>linked</i> in your editor.
 * @param {Function} require
 * @param {Underscore} _  
 */
emmet.define('tabStops', function(require, _) {
	/**
	 * Global placeholder value, automatically incremented by 
	 * <code>variablesResolver()</code> function
	 */
	var startPlaceholderNum = 100;
	
	var tabstopIndex = 0;
	
	var defaultOptions = {
		replaceCarets: false,
		escape: function(ch) {
			return '\\' + ch;
		},
		tabstop: function(data) {
			return data.token;
		},
		variable: function(data) {
			return data.token;
		}
	};
	
	// XXX register output processor that will upgrade tabstops of parsed node
	// in order to prevent tabstop index conflicts
	require('abbreviationParser').addOutputProcessor(function(text, node, type) {
		var maxNum = 0;
		var tabstops = require('tabStops');
		var utils = require('utils');
		
		var tsOptions = {
			tabstop: function(data) {
				var group = parseInt(data.group);
				if (group == 0)
					return '${0}';
				
				if (group > maxNum) maxNum = group;
				if (data.placeholder) {
					// respect nested placeholders
					var ix = group + tabstopIndex;
					var placeholder = tabstops.processText(data.placeholder, tsOptions);
					return '${' + ix + ':' + placeholder + '}';
				} else {
					return '${' + (group + tabstopIndex) + '}';
				}
			}
		};
		
		// upgrade tabstops
		text = tabstops.processText(text, tsOptions);
		
		// resolve variables
		text = utils.replaceVariables(text, tabstops.variablesResolver(node));
		
		tabstopIndex += maxNum + 1;
		return text;
	});
	
	return {
		/**
		 * Main function that looks for a tabstops in provided <code>text</code>
		 * and returns a processed version of <code>text</code> with expanded 
		 * placeholders and list of tabstops found.
		 * @param {String} text Text to process
		 * @param {Object} options List of processor options:<br>
		 * 
		 * <b>replaceCarets</b> : <code>Boolean</code> — replace all default
		 * caret placeholders (like <i>{%::emmet-caret::%}</i>) with <i>${0:caret}</i><br>
		 * 
		 * <b>escape</b> : <code>Function</code> — function that handle escaped
		 * characters (mostly '$'). By default, it returns the character itself 
		 * to be displayed as is in output, but sometimes you will use 
		 * <code>extract</code> method as intermediate solution for further 
		 * processing and want to keep character escaped. Thus, you should override
		 * <code>escape</code> method to return escaped symbol (e.g. '\\$')<br>
		 * 
		 * <b>tabstop</b> : <code>Function</code> – a tabstop handler. Receives 
		 * a single argument – an object describing token: its position, number 
		 * group, placeholder and token itself. Should return a replacement 
		 * string that will appear in final output
		 * 
		 * <b>variable</b> : <code>Function</code> – variable handler. Receives 
		 * a single argument – an object describing token: its position, name 
		 * and original token itself. Should return a replacement 
		 * string that will appear in final output
		 * 
		 * @returns {Object} Object with processed <code>text</code> property
		 * and array of <code>tabstops</code> found
		 * @memberOf tabStops
		 */
		extract: function(text, options) {
			// prepare defaults
			var utils = require('utils');
			var placeholders = {carets: ''};
			var marks = [];
			
			options = _.extend({}, defaultOptions, options, {
				tabstop: function(data) {
					var token = data.token;
					var ret = '';
					if (data.placeholder == 'cursor') {
						marks.push({
							start: data.start,
							end: data.start + token.length,
							group: 'carets',
							value: ''
						});
					} else {
						// unify placeholder value for single group
						if ('placeholder' in data)
							placeholders[data.group] = data.placeholder;
						
						if (data.group in placeholders)
							ret = placeholders[data.group];
						
						marks.push({
							start: data.start,
							end: data.start + token.length,
							group: data.group,
							value: ret
						});
					}
					
					return token;
				}
			});
			
			if (options.replaceCarets) {
				text = text.replace(new RegExp( utils.escapeForRegexp( utils.getCaretPlaceholder() ), 'g'), '${0:cursor}');
			}
			
			// locate tabstops and unify group's placeholders
			text = this.processText(text, options);
			
			// now, replace all tabstops with placeholders
			var buf = utils.stringBuilder(), lastIx = 0;
			var tabStops = _.map(marks, function(mark) {
				buf.append(text.substring(lastIx, mark.start));
				
				var pos = buf.length;
				var ph = placeholders[mark.group] || '';
				
				buf.append(ph);
				lastIx = mark.end;
				
				return {
					group: mark.group,
					start: pos,
					end:  pos + ph.length
				};
			});
			
			buf.append(text.substring(lastIx));
			
			return {
				text: buf.toString(),
				tabstops: _.sortBy(tabStops, 'start')
			};
		},
		
		/**
		 * Text processing routine. Locates escaped characters and tabstops and
		 * replaces them with values returned by handlers defined in 
		 * <code>options</code>
		 * @param {String} text
		 * @param {Object} options See <code>extract</code> method options 
		 * description
		 * @returns {String}
		 */
		processText: function(text, options) {
			options = _.extend({}, defaultOptions, options);
			
			var buf = require('utils').stringBuilder();
			/** @type StringStream */
			var stream = require('stringStream').create(text);
			var ch, m, a;
			
			while (ch = stream.next()) {
				if (ch == '\\' && !stream.eol()) {
					// handle escaped character
					buf.append(options.escape(stream.next()));
					continue;
				}
				
				a = ch;
				
				if (ch == '$') {
					// looks like a tabstop
					stream.start = stream.pos - 1;
					
					if (m = stream.match(/^[0-9]+/)) {
						// it's $N
						a = options.tabstop({
							start: buf.length, 
							group: stream.current().substr(1),
							token: stream.current()
						});
					} else if (m = stream.match(/^\{([a-z_\-][\w\-]*)\}/)) {
						// ${variable}
						a = options.variable({
							start: buf.length, 
							name: m[1],
							token: stream.current()
						});
					} else if (m = stream.match(/^\{([0-9]+)(:.+?)?\}/, false)) {
						// ${N:value} or ${N} placeholder
						// parse placeholder, including nested ones
						stream.skipToPair('{', '}');
						
						var obj = {
							start: buf.length, 
							group: m[1],
							token: stream.current()
						};
						
						var placeholder = obj.token.substring(obj.group.length + 2, obj.token.length - 1);
						
						if (placeholder) {
							obj.placeholder = placeholder.substr(1);
						}
						
						a = options.tabstop(obj);
					}
				}
				
				buf.append(a);
			}
			
			return buf.toString();
		},
		
		/**
		 * Upgrades tabstops in output node in order to prevent naming conflicts
		 * @param {AbbreviationNode} node
		 * @param {Number} offset Tab index offset
		 * @returns {Number} Maximum tabstop index in element
		 */
		upgrade: function(node, offset) {
			var maxNum = 0;
			var options = {
				tabstop: function(data) {
					var group = parseInt(data.group);
					if (group > maxNum) maxNum = group;
						
					if (data.placeholder)
						return '${' + (group + offset) + ':' + data.placeholder + '}';
					else
						return '${' + (group + offset) + '}';
				}
			};
			
			_.each(['start', 'end', 'content'], function(p) {
				node[p] = this.processText(node[p], options);
			}, this);
			
			return maxNum;
		},
		
		/**
		 * Helper function that produces a callback function for 
		 * <code>replaceVariables()</code> method from {@link utils}
		 * module. This callback will replace variable definitions (like 
		 * ${var_name}) with their value defined in <i>resource</i> module,
		 * or outputs tabstop with variable name otherwise.
		 * @param {AbbreviationNode} node Context node
		 * @returns {Function}
		 */
		variablesResolver: function(node) {
			var placeholderMemo = {};
			var res = require('resources');
			return function(str, varName) {
				// do not mark `child` variable as placeholder – it‘s a reserved
				// variable name
				if (varName == 'child')
					return str;
				
				if (varName == 'cursor')
					return require('utils').getCaretPlaceholder();
				
				var attr = node.attribute(varName);
				if (!_.isUndefined(attr))
					return attr;
				
				var varValue = res.getVariable(varName);
				if (varValue)
					return varValue;
				
				// output as placeholder
				if (!placeholderMemo[varName])
					placeholderMemo[varName] = startPlaceholderNum++;
					
				return '${' + placeholderMemo[varName] + ':' + varName + '}';
			};
		},
		
		resetPlaceholderCounter: function() {
			console.log('deprecated');
			startPlaceholderNum = 100;
		},
		
		/**
		 * Resets global tabstop index. When parsed tree is converted to output
		 * string (<code>AbbreviationNode.toString()</code>), all tabstops 
		 * defined in snippets and elements are upgraded in order to prevent
		 * naming conflicts of nested. For example, <code>${1}</code> of a node
		 * should not be linked with the same placehilder of the child node.
		 * By default, <code>AbbreviationNode.toString()</code> automatically
		 * upgrades tabstops of the same index for each node and writes maximum
		 * tabstop index into the <code>tabstopIndex</code> variable. To keep
		 * this variable at reasonable value, it is recommended to call 
		 * <code>resetTabstopIndex()</code> method each time you expand variable 
		 * @returns
		 */
		resetTabstopIndex: function() {
			tabstopIndex = 0;
			startPlaceholderNum = 100;
		}
	};
});/**
 * Common module's preferences storage. This module 
 * provides general storage for all module preferences, their description and
 * default values.<br><br>
 * 
 * This module can also be used to list all available properties to create 
 * UI for updating properties
 * 
 * @memberOf __preferencesDefine
 * @constructor
 * @param {Function} require
 * @param {Underscore} _ 
 */
emmet.define('preferences', function(require, _) {
	var preferences = {};
	var defaults = {};
	var _dbgDefaults = null;
	var _dbgPreferences = null;

	function toBoolean(val) {
		if (_.isString(val)) {
			val = val.toLowerCase();
			return val == 'yes' || val == 'true' || val == '1';
		}

		return !!val;
	}
	
	function isValueObj(obj) {
		return _.isObject(obj) 
			&& 'value' in obj 
			&& _.keys(obj).length < 3;
	}
	
	return {
		/**
		 * Creates new preference item with default value
		 * @param {String} name Preference name. You can also pass object
		 * with many options
		 * @param {Object} value Preference default value
		 * @param {String} description Item textual description
		 * @memberOf preferences
		 */
		define: function(name, value, description) {
			var prefs = name;
			if (_.isString(name)) {
				prefs = {};
				prefs[name] = {
					value: value,
					description: description
				};
			}
			
			_.each(prefs, function(v, k) {
				defaults[k] = isValueObj(v) ? v : {value: v};
			});
		},
		
		/**
		 * Updates preference item value. Preference value should be defined
		 * first with <code>define</code> method.
		 * @param {String} name Preference name. You can also pass object
		 * with many options
		 * @param {Object} value Preference default value
		 * @memberOf preferences
		 */
		set: function(name, value) {
			var prefs = name;
			if (_.isString(name)) {
				prefs = {};
				prefs[name] = value;
			}
			
			_.each(prefs, function(v, k) {
				if (!(k in defaults)) {
					throw 'Property "' + k + '" is not defined. You should define it first with `define` method of current module';
				}
				
				// do not set value if it equals to default value
				if (v !== defaults[k].value) {
					// make sure we have value of correct type
					switch (typeof defaults[k].value) {
						case 'boolean':
							v = toBoolean(v);
							break;
						case 'number':
							v = parseInt(v + '', 10) || 0;
							break;
						default: // convert to string
							v += '';
					}

					preferences[k] = v;
				} else if  (k in preferences) {
					delete preferences[k];
				}
			});
		},
		
		/**
		 * Returns preference value
		 * @param {String} name
		 * @returns {String} Returns <code>undefined</code> if preference is 
		 * not defined
		 */
		get: function(name) {
			if (name in preferences)
				return preferences[name];
			
			if (name in defaults)
				return defaults[name].value;
			
			return void 0;
		},
		
		/**
		 * Returns comma-separated preference value as array of values
		 * @param {String} name
		 * @returns {Array} Returns <code>undefined</code> if preference is 
		 * not defined, <code>null</code> if string cannot be converted to array
		 */
		getArray: function(name) {
			var val = this.get(name);
			if (!_.isUndefined(val)) {
				val = _.map(val.split(','), require('utils').trim);
				if (!val.length)
					val = null;
			}
			
			return val;
		},
		
		/**
		 * Returns comma and colon-separated preference value as dictionary
		 * @param {String} name
		 * @returns {Object}
		 */
		getDict: function(name) {
			var result = {};
			_.each(this.getArray(name), function(val) {
				var parts = val.split(':');
				result[parts[0]] = parts[1];
			});
			
			return result;
		},
		
		/**
		 * Returns description of preference item
		 * @param {String} name Preference name
		 * @returns {Object}
		 */
		description: function(name) {
			return name in defaults ? defaults[name].description : void 0;
		},
		
		/**
		 * Completely removes specified preference(s)
		 * @param {String} name Preference name (or array of names)
		 */
		remove: function(name) {
			if (!_.isArray(name))
				name = [name];
			
			_.each(name, function(key) {
				if (key in preferences)
					delete preferences[key];
				
				if (key in defaults)
					delete defaults[key];
			});
		},
		
		/**
		 * Returns sorted list of all available properties
		 * @returns {Array}
		 */
		list: function() {
			return _.map(_.keys(defaults).sort(), function(key) {
				return {
					name: key,
					value: this.get(key),
					type: typeof defaults[key].value,
					description: defaults[key].description
				};
			}, this);
		},
		
		/**
		 * Loads user-defined preferences from JSON
		 * @param {Object} json
		 * @returns
		 */
		load: function(json) {
			_.each(json, function(value, key) {
				this.set(key, value);
			}, this);
		},

		/**
		 * Returns hash of user-modified preferences
		 * @returns {Object}
		 */
		exportModified: function() {
			return _.clone(preferences);
		},
		
		/**
		 * Reset to defaults
		 * @returns
		 */
		reset: function() {
			preferences = {};
		},
		
		/**
		 * For unit testing: use empty storage
		 */
		_startTest: function() {
			_dbgDefaults = defaults;
			_dbgPreferences = preferences;
			defaults = {};
			preferences = {};
		},
		
		/**
		 * For unit testing: restore original storage
		 */
		_stopTest: function() {
			defaults = _dbgDefaults;
			preferences = _dbgPreferences;
		}
	};
});/**
 * Module for handling filters
 * @param {Function} require
 * @param {Underscore} _
 * @author Sergey Chikuyonok (serge.che@gmail.com) <http://chikuyonok.ru>
 */
emmet.define('filters', function(require, _) {
	/** List of registered filters */
	var registeredFilters = {};
	
	/** Filters that will be applied for unknown syntax */
	var basicFilters = 'html';
	
	function list(filters) {
		if (!filters)
			return [];
		
		if (_.isString(filters))
			return filters.split(/[\|,]/g);
		
		return filters;
	}
	
	return  {
		/**
		 * Register new filter
		 * @param {String} name Filter name
		 * @param {Function} fn Filter function
		 */
		add: function(name, fn) {
			registeredFilters[name] = fn;
		},
		
		/**
		 * Apply filters for final output tree
		 * @param {AbbreviationNode} tree Output tree
		 * @param {Array} filters List of filters to apply. Might be a 
		 * <code>String</code>
		 * @param {Object} profile Output profile, defined in <i>profile</i> 
		 * module. Filters defined it profile are not used, <code>profile</code>
		 * is passed to filter function
		 * @memberOf emmet.filters
		 * @returns {AbbreviationNode}
		 */
		apply: function(tree, filters, profile) {
			var utils = require('utils');
			profile = require('profile').get(profile);
			
			_.each(list(filters), function(filter) {
				var name = utils.trim(filter.toLowerCase());
				if (name && name in registeredFilters) {
					tree = registeredFilters[name](tree, profile);
				}
			});
			
			return tree;
		},
		
		/**
		 * Composes list of filters that should be applied to a tree, based on 
		 * passed data
		 * @param {String} syntax Syntax name ('html', 'css', etc.)
		 * @param {Object} profile Output profile
		 * @param {String} additionalFilters List or pipe-separated
		 * string of additional filters to apply
		 * @returns {Array}
		 */
		composeList: function(syntax, profile, additionalFilters) {
			profile = require('profile').get(profile);
			var filters = list(profile.filters || require('resources').findItem(syntax, 'filters') || basicFilters);
				
			if (additionalFilters)
				filters = filters.concat(list(additionalFilters));
				
			if (!filters || !filters.length)
				// looks like unknown syntax, apply basic filters
				filters = list(basicFilters);
				
			return filters;
		},
		
		/**
		 * Extracts filter list from abbreviation
		 * @param {String} abbr
		 * @returns {Array} Array with cleaned abbreviation and list of 
		 * extracted filters
		 */
		extractFromAbbreviation: function(abbr) {
			var filters = '';
			abbr = abbr.replace(/\|([\w\|\-]+)$/, function(str, p1){
				filters = p1;
				return '';
			});
			
			return [abbr, list(filters)];
		}
	};
});/**
 * Module that contains factories for element types used by Emmet
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.define('elements', function(require, _) {
	var factories = {};
	var reAttrs = /([\w\-]+)\s*=\s*(['"])(.*?)\2/g;
	
	var result = {
		/**
		 * Create new element factory
		 * @param {String} name Element identifier
		 * @param {Function} factory Function that produces element of specified 
		 * type. The object generated by this factory is automatically 
		 * augmented with <code>type</code> property pointing to element
		 * <code>name</code>
		 * @memberOf elements
		 */
		add: function(name, factory) {
			var that = this;
			factories[name] = function() {
				var elem = factory.apply(that, arguments);
				if (elem)
					elem.type = name;
				
				return elem;
			};
		},
		
		/**
		 * Returns factory for specified name
		 * @param {String} name
		 * @returns {Function}
		 */
		get: function(name) {
			return factories[name];
		},
		
		/**
		 * Creates new element with specified type
		 * @param {String} name
		 * @returns {Object}
		 */
		create: function(name) {
			var args = [].slice.call(arguments, 1);
			var factory = this.get(name);
			return factory ? factory.apply(this, args) : null;
		},
		
		/**
		 * Check if passed element is of specified type
		 * @param {Object} elem
		 * @param {String} type
		 * @returns {Boolean}
		 */
		is: function(elem, type) {
			return elem && elem.type === type;
		}
	};
	
	// register resource references
	function commonFactory(value) {
		return {data: value};
	}
	
	/**
	 * Element factory
	 * @param {String} elementName Name of output element
	 * @param {String} attrs Attributes definition. You may also pass
	 * <code>Array</code> where each contains object with <code>name</code> 
	 * and <code>value</code> properties, or <code>Object</code>
	 * @param {Boolean} isEmpty Is expanded element should be empty
	 */
	result.add('element', function(elementName, attrs, isEmpty) {
		var ret = {
			/** @memberOf __emmetDataElement */
			name: elementName,
			is_empty: !!isEmpty
		};
		
		if (attrs) {
			ret.attributes = [];
			if (_.isArray(attrs)) {
				ret.attributes = attrs;
			} else if (_.isString(attrs)) {
				var m;
				while (m = reAttrs.exec(attrs)) {
					ret.attributes.push({
						name: m[1],
						value: m[3]
					});
				}
			} else {
				_.each(attrs, function(value, name) {
					ret.attributes.push({
						name: name, 
						value: value
					});
				});
			}
		}
		
		return ret;
	});
	
	result.add('snippet', commonFactory);
	result.add('reference', commonFactory);
	result.add('empty', function() {
		return {};
	});
	
	return result;
});/**
 * Abstract implementation of edit tree interface.
 * Edit tree is a named container of editable “name-value” child elements, 
 * parsed from <code>source</code>. This container provides convenient methods
 * for editing/adding/removing child elements. All these update actions are
 * instantly reflected in the <code>source</code> code with respect of formatting.
 * <br><br>
 * For example, developer can create an edit tree from CSS rule and add or 
 * remove properties from it–all changes will be immediately reflected in the 
 * original source.
 * <br><br>
 * All classes defined in this module should be extended the same way as in
 * Backbone framework: using <code>extend</code> method to create new class and 
 * <code>initialize</code> method to define custom class constructor.
 * 
 * @example
 * <pre><code>
 * var MyClass = require('editTree').EditElement.extend({
 * 	initialize: function() {
 * 		// constructor code here
 * 	}
 * });
 * 
 * var elem = new MyClass(); 
 * </code></pre>
 * 
 * 
 * @param {Function} require
 * @param {Underscore} _
 * @constructor
 * @memberOf __editTreeDefine
 */
emmet.define('editTree', function(require, _, core) {
	var range = require('range').create;
	
	/**
	 * Named container of edited source
	 * @type EditContainer
	 * @param {String} source
	 * @param {Object} options
	 */
	function EditContainer(source, options) {
		this.options = _.extend({offset: 0}, options);
		/**
		 * Source code of edited structure. All changes in the structure are 
		 * immediately reflected into this property
		 */
		this.source = source;
		
		/** 
		 * List of all editable children
		 * @private 
		 */
		this._children = [];
		
		/**
		 * Hash of all positions of container
		 * @private
		 */
		this._positions = {
			name: 0
		};
		
		this.initialize.apply(this, arguments);
	}
	
	/**
	 * The self-propagating extend function for classes.
	 * @type Function
	 */
	EditContainer.extend = core.extend;
	
	EditContainer.prototype = {
		/**
		 * Child class constructor
		 */
		initialize: function() {},
		
		/**
		 * Replace substring of tag's source
		 * @param {String} value
		 * @param {Number} start
		 * @param {Number} end
		 * @private
		 */
		_updateSource: function(value, start, end) {
			// create modification range
			var r = range(start, _.isUndefined(end) ? 0 : end - start);
			var delta = value.length - r.length();
			
			var update = function(obj) {
				_.each(obj, function(v, k) {
					if (v >= r.end)
						obj[k] += delta;
				});
			};
			
			// update affected positions of current container
			update(this._positions);
			
			// update affected positions of children
			_.each(this.list(), function(item) {
				update(item._positions);
			});
			
			this.source = require('utils').replaceSubstring(this.source, value, r);
		},
			
			
		/**
		 * Adds new attribute 
		 * @param {String} name Property name
		 * @param {String} value Property value
		 * @param {Number} pos Position at which to insert new property. By 
		 * default the property is inserted at the end of rule 
		 * @returns {EditElement} Newly created element
		 */
		add: function(name, value, pos) {
			// this is abstract implementation
			var item = new EditElement(name, value);
			this._children.push(item);
			return item;
		},
		
		/**
		 * Returns attribute object
		 * @param {String} name Attribute name or its index
		 * @returns {EditElement}
		 */
		get: function(name) {
			if (_.isNumber(name))
				return this.list()[name];
			
			if (_.isString(name))
				return _.find(this.list(), function(prop) {
					return prop.name() === name;
				});
			
			return name;
		},
		
		/**
		 * Returns all children by name or indexes
		 * @param {Object} name Element name(s) or indexes (<code>String</code>,
		 * <code>Array</code>, <code>Number</code>)
		 * @returns {Array}
		 */
		getAll: function(name) {
			if (!_.isArray(name))
				name = [name];
			
			// split names and indexes
			var names = [], indexes = [];
			_.each(name, function(item) {
				if (_.isString(item))
					names.push(item);
				else if (_.isNumber(item))
					indexes.push(item);
			});
			
			return _.filter(this.list(), function(attribute, i) {
				return _.include(indexes, i) || _.include(names, attribute.name());
			});
		},
		
		/**
		 * Returns or updates element value. If such element doesn't exists,
		 * it will be created automatically and added at the end of child list.
		 * @param {String} name Element name or its index
		 * @param {String} value New element value
		 * @returns {String}
		 */
		value: function(name, value, pos) {
			var element = this.get(name);
			if (element)
				return element.value(value);
			
			if (!_.isUndefined(value)) {
				// no such element — create it
				return this.add(name, value, pos);
			}
		},
		
		/**
		 * Returns all values of child elements found by <code>getAll()</code>
		 * method
		 * @param {Object} name Element name(s) or indexes (<code>String</code>,
		 * <code>Array</code>, <code>Number</code>)
		 * @returns {Array}
		 */
		values: function(name) {
			return _.map(this.getAll(name), function(element) {
				return element.value();
			});
		},
		
		/**
		 * Remove child element
		 * @param {String} name Property name or its index
		 */
		remove: function(name) {
			var element = this.get(name);
			if (element) {
				this._updateSource('', element.fullRange());
				this._children = _.without(this._children, element);
			}
		},
		
		/**
		 * Returns list of all editable child elements
		 * @returns {Array}
		 */
		list: function() {
			return this._children;
		},
		
		/**
		 * Returns index of editble child in list
		 * @param {Object} item
		 * @returns {Number}
		 */
		indexOf: function(item) {
			return _.indexOf(this.list(), this.get(item));
		},
		
		/**
		 * Sets or gets container name
		 * @param {String} val New name. If not passed, current 
		 * name is returned
		 * @return {String}
		 */
		name: function(val) {
			if (!_.isUndefined(val) && this._name !== (val = String(val))) {
				this._updateSource(val, this._positions.name, this._positions.name + this._name.length);
				this._name = val;
			}
			
			return this._name;
		},
		
		/**
		 * Returns name range object
		 * @param {Boolean} isAbsolute Return absolute range (with respect of 
		 * rule offset)
		 * @returns {Range}
		 */
		nameRange: function(isAbsolute) {
			return range(this._positions.name + (isAbsolute ? this.options.offset : 0), this.name());
		},
		
		/**
		 * Returns range of current source
		 * @param {Boolean} isAbsolute
		 */
		range: function(isAbsolute) {
			return range(isAbsolute ? this.options.offset : 0, this.toString());
		},
		
		/**
		 * Returns element that belongs to specified position
		 * @param {Number} pos
		 * @param {Boolean} isAbsolute
		 * @returns {EditElement}
		 */
		itemFromPosition: function(pos, isAbsolute) {
			return _.find(this.list(), function(elem) {
				return elem.range(isAbsolute).inside(pos);
			});
		},
		
		/**
		 * Returns source code of current container 
		 * @returns {String}
		 */
		toString: function() {
			return this.source;
		}
	};
	
	/**
	 * @param {EditContainer} parent
	 * @param {Object} nameToken
	 * @param {Object} valueToken
	 */
	function EditElement(parent, nameToken, valueToken) {
		/** @type EditContainer */
		this.parent = parent;
		
		this._name = nameToken.value;
		this._value = valueToken ? valueToken.value : '';
		
		this._positions = {
			name: nameToken.start,
			value: valueToken ? valueToken.start : -1
		};
		
		this.initialize.apply(this, arguments);
	}
	
	/**
	 * The self-propagating extend function for classes.
	 * @type Function
	 */
	EditElement.extend = core.extend;
	
	EditElement.prototype = {
		/**
		 * Child class constructor
		 */
		initialize: function() {},
		
		/**
		 * Make position absolute
		 * @private
		 * @param {Number} num
		 * @param {Boolean} isAbsolute
		 * @returns {Boolean}
		 */
		_pos: function(num, isAbsolute) {
			return num + (isAbsolute ? this.parent.options.offset : 0);
		},
			
		/**
		 * Sets of gets element value
		 * @param {String} val New element value. If not passed, current 
		 * value is returned
		 * @returns {String}
		 */
		value: function(val) {
			if (!_.isUndefined(val) && this._value !== (val = String(val))) {
				this.parent._updateSource(val, this.valueRange());
				this._value = val;
			}
			
			return this._value;
		},
		
		/**
		 * Sets of gets element name
		 * @param {String} val New element name. If not passed, current 
		 * name is returned
		 * @returns {String}
		 */
		name: function(val) {
			if (!_.isUndefined(val) && this._name !== (val = String(val))) {
				this.parent._updateSource(val, this.nameRange());
				this._name = val;
			}
			
			return this._name;
		},
		
		/**
		 * Returns position of element name token
		 * @param {Boolean} isAbsolute Return absolute position
		 * @returns {Number}
		 */
		namePosition: function(isAbsolute) {
			return this._pos(this._positions.name, isAbsolute);
		},
		
		/**
		 * Returns position of element value token
		 * @param {Boolean} isAbsolute Return absolute position
		 * @returns {Number}
		 */
		valuePosition: function(isAbsolute) {
			return this._pos(this._positions.value, isAbsolute);
		},
		
		/**
		 * Returns element name
		 * @param {Boolean} isAbsolute Return absolute range 
		 * @returns {Range}
		 */
		range: function(isAbsolute) {
			return range(this.namePosition(isAbsolute), this.toString());
		},
		
		/**
		 * Returns full element range, including possible indentation
		 * @param {Boolean} isAbsolute Return absolute range
		 * @returns {Range}
		 */
		fullRange: function(isAbsolute) {
			return this.range(isAbsolute);
		},
		
		/**
		 * Returns element name range
		 * @param {Boolean} isAbsolute Return absolute range
		 * @returns {Range}
		 */
		nameRange: function(isAbsolute) {
			return range(this.namePosition(isAbsolute), this.name());
		},
		
		/**
		 * Returns element value range
		 * @param {Boolean} isAbsolute Return absolute range
		 * @returns {Range}
		 */
		valueRange: function(isAbsolute) {
			return range(this.valuePosition(isAbsolute), this.value());
		},
		
		/**
		 * Returns current element string representation
		 * @returns {String}
		 */
		toString: function() {
			return this.name() + this.value();
		},
		
		valueOf: function() {
			return this.toString();
		}
	};
	
	return {
		EditContainer: EditContainer,
		EditElement: EditElement,
		
		/**
		 * Creates token that can be fed to <code>EditElement</code>
		 * @param {Number} start
		 * @param {String} value
		 * @param {String} type
		 * @returns
		 */
		createToken: function(start, value, type) {
			var obj = {
				start: start || 0,
				value: value || '',
				type: type
			};
			
			obj.end = obj.start + obj.value.length;
			return obj;
		}
	};
});/**
 * CSS EditTree is a module that can parse a CSS rule into a tree with 
 * convenient methods for adding, modifying and removing CSS properties. These 
 * changes can be written back to string with respect of code formatting.
 * 
 * @memberOf __cssEditTreeDefine
 * @constructor
 * @param {Function} require
 * @param {Underscore} _ 
 */
emmet.define('cssEditTree', function(require, _) {
	var defaultOptions = {
		styleBefore: '\n\t',
		styleSeparator: ': ',
		offset: 0
	};
	
	var WHITESPACE_REMOVE_FROM_START = 1;
	var WHITESPACE_REMOVE_FROM_END   = 2;
	
	/**
	 * Returns range object
	 * @param {Number} start
	 * @param {Number} len 
	 * @returns {Range}
	 */
	function range(start, len) {
		return require('range').create(start, len);
	}
	
	/**
	 * Removes whitespace tokens from the array ends
	 * @param {Array} tokens
	 * @param {Number} mask Mask indicating from which end whitespace should be 
	 * removed 
	 * @returns {Array}
	 */
	function trimWhitespaceTokens(tokens, mask) {
		mask = mask || (WHITESPACE_REMOVE_FROM_START | WHITESPACE_REMOVE_FROM_END);
		var whitespace = ['white', 'line'];
		
		if ((mask & WHITESPACE_REMOVE_FROM_END) == WHITESPACE_REMOVE_FROM_END)
			while (tokens.length && _.include(whitespace, _.last(tokens).type)) {
				tokens.pop();
	 		}
		
		if ((mask & WHITESPACE_REMOVE_FROM_START) == WHITESPACE_REMOVE_FROM_START)
			while (tokens.length && _.include(whitespace, tokens[0].type)) {
				tokens.shift();
			}
		
		return tokens;
	}
	
	/**
	 * Helper function that searches for selector range for <code>CSSEditRule</code>
	 * @param {TokenIterator} it
	 * @returns {Range}
	 */
	function findSelectorRange(it) {
		var tokens = [], token;
 		var start = it.position(), end;
 		
 		while (token = it.next()) {
			if (token.type == '{')
				break;
			tokens.push(token);
		}
 		
 		trimWhitespaceTokens(tokens);
 		
 		if (tokens.length) {
 			start = tokens[0].start;
 			end = _.last(tokens).end;
 		} else {
 			end = start;
 		}
 		
 		return range(start, end - start);
	}
	
	/**
	 * Helper function that searches for CSS property value range next to
	 * iterator's current position  
	 * @param {TokenIterator} it
	 * @returns {Range}
	 */
	function findValueRange(it) {
		// find value start position
		var skipTokens = ['white', 'line', ':'];
		var tokens = [], token, start, end;
		
		it.nextUntil(function(tok) {
			return !_.include(skipTokens, this.itemNext().type);
		});
		
		start = it.current().end;
		// consume value
		while (token = it.next()) {
			if (token.type == '}' || token.type == ';') {
				// found value end
				trimWhitespaceTokens(tokens, WHITESPACE_REMOVE_FROM_START 
						| (token.type == '}' ? WHITESPACE_REMOVE_FROM_END : 0));
				
				if (tokens.length) {
					start = tokens[0].start;
					end = _.last(tokens).end;
				} else {
					end = start;
				}
				
				return range(start, end - start);
			}
			
			tokens.push(token);
		}
		
		// reached the end of tokens list
		if (tokens.length) {
			return range(tokens[0].start, _.last(tokens).end - tokens[0].start);
		}
	}
	
	/**
	 * Finds parts of complex CSS value
	 * @param {String} str
	 * @returns {Array} Returns list of <code>Range</code>'s
	 */
	function findParts(str) {
		/** @type StringStream */
		var stream = require('stringStream').create(str);
		var ch;
		var result = [];
		var sep = /[\s\u00a0,]/;
		
		var add = function() {
			stream.next();
			result.push(range(stream.start, stream.current()));
			stream.start = stream.pos;
		};
		
		// skip whitespace
		stream.eatSpace();
		stream.start = stream.pos;
		
		while (ch = stream.next()) {
			if (ch == '"' || ch == "'") {
				stream.next();
				if (!stream.skipTo(ch)) break;
				add();
			} else if (ch == '(') {
				// function found, may have nested function
				stream.backUp(1);
				if (!stream.skipToPair('(', ')')) break;
				stream.backUp(1);
				add();
			} else {
				if (sep.test(ch)) {
					result.push(range(stream.start, stream.current().length - 1));
					stream.eatWhile(sep);
					stream.start = stream.pos;
				}
			}
		}
		
		add();
		
		return _.chain(result)
			.filter(function(item) {
				return !!item.length();
			})
			.uniq(false, function(item) {
				return item.toString();
			})
			.value();
	}
	
	/**
	 * A bit hacky way to identify invalid CSS property definition: when user
	 * starts writing new abbreviation in CSS rule, he actually creates invalid
	 * CSS property definition and this method tries to identify such abbreviation
	 * and prevent it from being added to CSS edit tree 
	 * @param {TokenIterator} it
	 */
	function isValidIdentifier(it) {
//		return true;
		var tokens = it.tokens;
		for (var i = it._i + 1, il = tokens.length; i < il; i++) {
			if (tokens[i].type == ':')
				return true;
			
			if (tokens[i].type == 'identifier' || tokens[i].type == 'line')
				return false;
		}
		
		return false;
	}
	
	/**
	 * @class
	 * @extends EditContainer
	 */
	var CSSEditContainer = require('editTree').EditContainer.extend({
		initialize: function(source, options) {
			_.defaults(this.options, defaultOptions);
			var editTree = require('editTree');
			
			/** @type TokenIterator */
	 		var it = require('tokenIterator').create(
	 				require('cssParser').parse(source));
	 		
	 		var selectorRange = findSelectorRange(it);
	 		this._positions.name = selectorRange.start;
	 		this._name = selectorRange.substring(source);
	 		
	 		if (!it.current() || it.current().type != '{')
	 			throw 'Invalid CSS rule';
	 		
	 		this._positions.contentStart = it.position() + 1;
	 		
	 		// consume properties
	 		var propertyRange, valueRange, token;
			while (token = it.next()) {
				if (token.type == 'identifier' && isValidIdentifier(it)) {
					propertyRange = range(token);
					valueRange = findValueRange(it);
					var end = (it.current() && it.current().type == ';') 
						? range(it.current())
						: range(valueRange.end, 0);
					this._children.push(new CSSEditElement(this,
							editTree.createToken(propertyRange.start, propertyRange.substring(source)),
							editTree.createToken(valueRange.start, valueRange.substring(source)),
							editTree.createToken(end.start, end.substring(source))
							));
				}
			}
			
			this._saveStyle();
		},
		
		/**
		 * Remembers all styles of properties
		 * @private
		 */
		_saveStyle: function() {
			var start = this._positions.contentStart;
			var source = this.source;
			var utils = require('utils');
			
			_.each(this.list(), /** @param {CSSEditProperty} p */ function(p) {
				p.styleBefore = source.substring(start, p.namePosition());
				// a small hack here:
				// Sometimes users add empty lines before properties to logically
				// separate groups of properties. In this case, a blind copy of
				// characters between rules may lead to undesired behavior,
				// especially when current rule is duplicated or used as a donor
				// to create new rule.
				// To solve this issue, we‘ll take only last newline indentation
				var lines = utils.splitByLines(p.styleBefore);
				if (lines.length > 1) {
					p.styleBefore = '\n' + _.last(lines);
				}
				
				p.styleSeparator = source.substring(p.nameRange().end, p.valuePosition());
				
				// graceful and naive comments removal 
				p.styleBefore = _.last(p.styleBefore.split('*/'));
				p.styleSeparator = p.styleSeparator.replace(/\/\*.*?\*\//g, '');
				
				start = p.range().end;
			});
		},
		
		/**
		 * Adds new CSS property 
		 * @param {String} name Property name
		 * @param {String} value Property value
		 * @param {Number} pos Position at which to insert new property. By 
		 * default the property is inserted at the end of rule 
		 * @returns {CSSEditProperty}
		 */
		add: function(name, value, pos) {
			var list = this.list();
			var start = this._positions.contentStart;
			var styles = _.pick(this.options, 'styleBefore', 'styleSeparator');
			var editTree = require('editTree');
			
			if (_.isUndefined(pos))
				pos = list.length;
			
			/** @type CSSEditProperty */
			var donor = list[pos];
			if (donor) {
				start = donor.fullRange().start;
			} else if (donor = list[pos - 1]) {
				// make sure that donor has terminating semicolon
				donor.end(';');
				start = donor.range().end;
			}
			
			if (donor) {
				styles = _.pick(donor, 'styleBefore', 'styleSeparator');
			}
			
			var nameToken = editTree.createToken(start + styles.styleBefore.length, name);
			var valueToken = editTree.createToken(nameToken.end + styles.styleSeparator.length, value);
			
			var property = new CSSEditElement(this, nameToken, valueToken,
					editTree.createToken(valueToken.end, ';'));
			
			_.extend(property, styles);
			
			// write new property into the source
			this._updateSource(property.styleBefore + property.toString(), start);
			
			// insert new property
			this._children.splice(pos, 0, property);
			return property;
		}
	});
	
	/**
	 * @class
	 * @type CSSEditElement
	 * @constructor
	 */
	var CSSEditElement = require('editTree').EditElement.extend({
		initialize: function(rule, name, value, end) {
			this.styleBefore = rule.options.styleBefore;
			this.styleSeparator = rule.options.styleSeparator;
			
			this._end = end.value;
			this._positions.end = end.start;
		},
		
		/**
		 * Returns ranges of complex value parts
		 * @returns {Array} Returns <code>null</code> if value is not complex
		 */
		valueParts: function(isAbsolute) {
			var parts = findParts(this.value());
			if (isAbsolute) {
				var offset = this.valuePosition(true);
				_.each(parts, function(p) {
					p.shift(offset);
				});
			}
			
			return parts;
		},
		
		/**
		 * Sets of gets property end value (basically, it's a semicolon)
		 * @param {String} val New end value. If not passed, current 
		 * value is returned
		 */
		end: function(val) {
			if (!_.isUndefined(val) && this._end !== val) {
				this.parent._updateSource(val, this._positions.end, this._positions.end + this._end.length);
				this._end = val;
			}
			
			return this._end;
		},
		
		/**
		 * Returns full rule range, with indentation
		 * @param {Boolean} isAbsolute Return absolute range (with respect of
		 * rule offset)
		 * @returns {Range}
		 */
		fullRange: function(isAbsolute) {
			var r = this.range(isAbsolute);
			r.start -= this.styleBefore.length;
			return r;
		},
		
		/**
		 * Returns item string representation
		 * @returns {String}
		 */
		toString: function() {
			return this.name() + this.styleSeparator + this.value() + this.end();
		}
	});
	
	return {
		/**
		 * Parses CSS rule into editable tree
		 * @param {String} source
		 * @param {Object} options
		 * @memberOf emmet.cssEditTree
		 * @returns {EditContainer}
		 */
		parse: function(source, options) {
			return new CSSEditContainer(source, options);
		},
		
		/**
		 * Extract and parse CSS rule from specified position in <code>content</code> 
		 * @param {String} content CSS source code
		 * @param {Number} pos Character position where to start source code extraction
		 * @returns {EditContainer}
		 */
		parseFromPosition: function(content, pos, isBackward) {
			var bounds = this.extractRule(content, pos, isBackward);
			if (!bounds || !bounds.inside(pos))
				// no matching CSS rule or caret outside rule bounds
				return null;
			
			return this.parse(bounds.substring(content), {
				offset: bounds.start
			});
		},
		
		/**
		 * Extracts single CSS selector definition from source code
		 * @param {String} content CSS source code
		 * @param {Number} pos Character position where to start source code extraction
		 * @returns {Range}
		 */
		extractRule: function(content, pos, isBackward) {
			var result = '';
			var len = content.length;
			var offset = pos;
			var stopChars = '{}/\\<>\n\r';
			var bracePos = -1, ch;
			
			// search left until we find rule edge
			while (offset >= 0) {
				ch = content.charAt(offset);
				if (ch == '{') {
					bracePos = offset;
					break;
				}
				else if (ch == '}' && !isBackward) {
					offset++;
					break;
				}
				
				offset--;
			}
			
			// search right for full rule set
			while (offset < len) {
				ch = content.charAt(offset);
				if (ch == '{') {
					bracePos = offset;
				} else if (ch == '}') {
					if (bracePos != -1)
						result = content.substring(bracePos, offset + 1);
					break;
				}
				
				offset++;
			}
			
			if (result) {
				// find CSS selector
				offset = bracePos - 1;
				var selector = '';
				while (offset >= 0) {
					ch = content.charAt(offset);
					if (stopChars.indexOf(ch) != -1) break;
					offset--;
				}
				
				// also trim whitespace
				selector = content.substring(offset + 1, bracePos).replace(/^[\s\n\r]+/m, '');
				return require('range').create(bracePos - selector.length, result.length + selector.length);
			}
			
			return null;
		},
		
		/**
	 	 * Removes vendor prefix from CSS property
	 	 * @param {String} name CSS property
	 	 * @return {String}
	 	 */
	 	baseName: function(name) {
	 		return name.replace(/^\s*\-\w+\-/, '');
	 	},
	 	
	 	/**
	 	 * Finds parts of complex CSS value
	 	 * @param {String} str
	 	 * @returns {Array}
	 	 */
	 	findParts: findParts
	};
});/**
 * XML EditTree is a module that can parse an XML/HTML element into a tree with 
 * convenient methods for adding, modifying and removing attributes. These 
 * changes can be written back to string with respect of code formatting.
 * 
 * @memberOf __xmlEditTreeDefine
 * @constructor
 * @param {Function} require
 * @param {Underscore} _ 
 */
emmet.define('xmlEditTree', function(require, _) {
	var defaultOptions = {
		styleBefore: ' ',
		styleSeparator: '=',
		styleQuote: '"',
		offset: 0
	};
	
	var startTag = /^<([\w\:\-]+)((?:\s+[\w\-:]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/m;
	
	var XMLEditContainer = require('editTree').EditContainer.extend({
		initialize: function(source, options) {
			_.defaults(this.options, defaultOptions);
			this._positions.name = 1;
			
			var attrToken = null;
			var tokens = require('xmlParser').parse(source);
			var range = require('range');
			
			_.each(tokens, function(token) {
				token.value = range.create(token).substring(source);
				switch (token.type) {
					case 'tag':
						if (/^<[^\/]+/.test(token.value)) {
							this._name = token.value.substring(1);
						}
						break;
						
					case 'attribute':
						// add empty attribute
						if (attrToken) {
							this._children.push(new XMLEditElement(this, attrToken));
						}
						
						attrToken = token;
						break;
						
					case 'string':
						this._children.push(new XMLEditElement(this, attrToken, token));
						attrToken = null;
						break;
				}
			}, this);
			
			if (attrToken) {
				this._children.push(new XMLEditElement(this, attrToken));
			}
			
			this._saveStyle();
		},
		
		/**
		 * Remembers all styles of properties
		 * @private
		 */
		_saveStyle: function() {
			var start = this.nameRange().end;
			var source = this.source;
			
			_.each(this.list(), /** @param {EditElement} p */ function(p) {
				p.styleBefore = source.substring(start, p.namePosition());
				
				if (p.valuePosition() !== -1) {
					p.styleSeparator = source.substring(p.namePosition() + p.name().length, p.valuePosition() - p.styleQuote.length);
				}
				
				start = p.range().end;
			});
		},
		
		/**
		 * Adds new attribute 
		 * @param {String} name Property name
		 * @param {String} value Property value
		 * @param {Number} pos Position at which to insert new property. By 
		 * default the property is inserted at the end of rule 
		 */
		add: function(name, value, pos) {
			var list = this.list();
			var start = this.nameRange().end;
			var editTree = require('editTree');
			var styles = _.pick(this.options, 'styleBefore', 'styleSeparator', 'styleQuote');
			
			if (_.isUndefined(pos))
				pos = list.length;
			
			
			/** @type XMLEditAttribute */
			var donor = list[pos];
			if (donor) {
				start = donor.fullRange().start;
			} else if (donor = list[pos - 1]) {
				start = donor.range().end;
			}
			
			if (donor) {
				styles = _.pick(donor, 'styleBefore', 'styleSeparator', 'styleQuote');
			}
			
			value = styles.styleQuote + value + styles.styleQuote;
			
			var attribute = new XMLEditElement(this, 
					editTree.createToken(start + styles.styleBefore.length, name),
					editTree.createToken(start + styles.styleBefore.length + name.length 
							+ styles.styleSeparator.length, value)
					);
			
			_.extend(attribute, styles);
			
			// write new attribute into the source
			this._updateSource(attribute.styleBefore + attribute.toString(), start);
			
			// insert new attribute
			this._children.splice(pos, 0, attribute);
			return attribute;
		}
	});
	
	var XMLEditElement = require('editTree').EditElement.extend({
		initialize: function(parent, nameToken, valueToken) {
			this.styleBefore = parent.options.styleBefore;
			this.styleSeparator = parent.options.styleSeparator;
			
			var value = '', quote = parent.options.styleQuote;
			if (valueToken) {
				value = valueToken.value;
				quote = value.charAt(0);
				if (quote == '"' || quote == "'") {
					value = value.substring(1);
				} else {
					quote = '';
				}
				
				if (quote && value.charAt(value.length - 1) == quote) {
					value = value.substring(0, value.length - 1);
				}
			}
			
			this.styleQuote = quote;
			
			this._value = value;
			this._positions.value = valueToken ? valueToken.start + quote.length : -1;
		},
		
		/**
		 * Returns full rule range, with indentation
		 * @param {Boolean} isAbsolute Return absolute range (with respect of
		 * rule offset)
		 * @returns {Range}
		 */
		fullRange: function(isAbsolute) {
			var r = this.range(isAbsolute);
			r.start -= this.styleBefore.length;
			return r;
		},
		
		toString: function() {
			return this.name() + this.styleSeparator
				+ this.styleQuote + this.value() + this.styleQuote;
		}
	});
	
	return {
		/**
		 * Parses HTML element into editable tree
		 * @param {String} source
		 * @param {Object} options
		 * @memberOf emmet.htmlEditTree
		 * @returns {EditContainer}
		 */
		parse: function(source, options) {
			return new XMLEditContainer(source, options);
		},
		
		/**
		 * Extract and parse HTML from specified position in <code>content</code> 
		 * @param {String} content CSS source code
		 * @param {Number} pos Character position where to start source code extraction
		 * @returns {XMLEditElement}
		 */
		parseFromPosition: function(content, pos, isBackward) {
			var bounds = this.extractTag(content, pos, isBackward);
			if (!bounds || !bounds.inside(pos))
				// no matching HTML tag or caret outside tag bounds
				return null;
			
			return this.parse(bounds.substring(content), {
				offset: bounds.start
			});
		},
		
		/**
		 * Extracts nearest HTML tag range from <code>content</code>, starting at 
		 * <code>pos</code> position
		 * @param {String} content
		 * @param {Number} pos
		 * @param {Boolean} isBackward
		 * @returns {Range}
		 */
		extractTag: function(content, pos, isBackward) {
			var len = content.length, i;
			var range = require('range');
			
			// max extraction length. I don't think there may be tags larger 
			// than 2000 characters length
			var maxLen = Math.min(2000, len);
			
			/** @type Range */
			var r = null;
			
			var match = function(pos) {
				var m;
				if (content.charAt(pos) == '<' && (m = content.substr(pos, maxLen).match(startTag)))
					return range.create(pos, m[0]);
			};
			
			// lookup backward, in case we are inside tag already
			for (i = pos; i >= 0; i--) {
				if (r = match(i)) break;
			}
			
			if (r && (r.inside(pos) || isBackward))
				return r;
			
			if (!r && isBackward)
				return null;
			
			// search forward
			for (i = pos; i < len; i++) {
				if (r = match(i))
					return r;
			}
		}
	};
});/**
 * 'Expand abbreviation' editor action: extracts abbreviation from current caret 
 * position and replaces it with formatted output. 
 * <br><br>
 * This behavior can be overridden with custom handlers which can perform 
 * different actions when 'Expand Abbreviation' action is called.
 * For example, a CSS gradient handler that produces vendor-prefixed gradient
 * definitions registers its own expand abbreviation handler.  
 *  
 * @constructor
 * @memberOf __expandAbbreviationActionDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.define('expandAbbreviation', function(require, _) {
	/**
	 * @type HandlerList List of registered handlers
	 */
	var handlers = require('handlerList').create();
	
	/** Back-reference to module */
	var module = null;
	
	var actions = require('actions');
	/**
	 * 'Expand abbreviation' editor action 
	 * @param {IEmmetEditor} editor Editor instance
	 * @param {String} syntax Syntax type (html, css, etc.)
	 * @param {String} profile Output profile name (html, xml, xhtml)
	 * @return {Boolean} Returns <code>true</code> if abbreviation was expanded 
	 * successfully
	 */
	actions.add('expand_abbreviation', function(editor, syntax, profile) {
		var args = _.toArray(arguments);
		
		// normalize incoming arguments
		var info = require('editorUtils').outputInfo(editor, syntax, profile);
		args[1] = info.syntax;
		args[2] = info.profile;
		
		return handlers.exec(false, args);
	});
	
	/**
	 * A special version of <code>expandAbbreviation</code> function: if it can't
	 * find abbreviation, it will place Tab character at caret position
	 * @param {IEmmetEditor} editor Editor instance
	 * @param {String} syntax Syntax type (html, css, etc.)
	 * @param {String} profile Output profile name (html, xml, xhtml)
	 */
	actions.add('expand_abbreviation_with_tab', function(editor, syntax, profile) {
		// do nothing if there is a selection
		var sel = !!editor.getSelection();
		var indent = require('resources').getVariable('indentation');
//		TODO create indentation
//		if (sel) {
//			// create a proper indentation, if there’s a selection that
//			// spans multiple lines
//			if (/[\r\n]/.test(sel)) {
//				var info = require('editorUtils').outputInfo(editor, syntax);
//				var selRange = require('range').create(editor.getSelectionRange());
//				
//			}
//			
//			return;
//		}
		
		
		if (sel || !actions.run('expand_abbreviation', editor, syntax, profile)) {
			editor.replaceContent(indent, editor.getCaretPos());
		}
	}, {hidden: true});
	
	// XXX setup default handler
	/**
	 * Extracts abbreviation from current caret 
	 * position and replaces it with formatted output 
	 * @param {IEmmetEditor} editor Editor instance
	 * @param {String} syntax Syntax type (html, css, etc.)
	 * @param {String} profile Output profile name (html, xml, xhtml)
	 * @return {Boolean} Returns <code>true</code> if abbreviation was expanded 
	 * successfully
	 */
	handlers.add(function(editor, syntax, profile) {
		var caretPos = editor.getSelectionRange().end;
		var abbr = module.findAbbreviation(editor);
			
		if (abbr) {
			var content = emmet.expandAbbreviation(abbr, syntax, profile, 
					require('actionUtils').captureContext(editor));
			if (content) {
				editor.replaceContent(content, caretPos - abbr.length, caretPos);
				return true;
			}
		}
		
		return false;
	}, {order: -1});
	
	return module = {
		/**
		 * Adds custom expand abbreviation handler. The passed function should 
		 * return <code>true</code> if it was performed successfully, 
		 * <code>false</code> otherwise.
		 * 
		 * Added handlers will be called when 'Expand Abbreviation' is called
		 * in order they were added
		 * @memberOf expandAbbreviation
		 * @param {Function} fn
		 * @param {Object} options
		 */
		addHandler: function(fn, options) {
			handlers.add(fn, options);
		},
		
		/**
		 * Removes registered handler
		 * @returns
		 */
		removeHandler: function(fn) {
			handlers.remove(fn, options);
		},
		
		/**
		 * Search for abbreviation in editor from current caret position
		 * @param {IEmmetEditor} editor Editor instance
		 * @return {String}
		 */
		findAbbreviation: function(editor) {
			/** @type Range */
			var range = require('range').create(editor.getSelectionRange());
			var content = String(editor.getContent());
			if (range.length()) {
				// abbreviation is selected by user
				return range.substring(content);
			}
			
			// search for new abbreviation from current caret position
			var curLine = editor.getCurrentLineRange();
			return require('actionUtils').extractAbbreviation(content.substring(curLine.start, range.start));
		}
	};
});/**
 * Action that wraps content with abbreviation. For convenience, action is 
 * defined as reusable module
 * @constructor
 * @memberOf __wrapWithAbbreviationDefine
 */
emmet.define('wrapWithAbbreviation', function(require, _) {
	/** Back-references to current module */
	var module = null;
	
	/**
	 * Wraps content with abbreviation
	 * @param {IEmmetEditor} Editor instance
	 * @param {String} abbr Abbreviation to wrap with
	 * @param {String} syntax Syntax type (html, css, etc.)
	 * @param {String} profile Output profile name (html, xml, xhtml)
	 */
	require('actions').add('wrap_with_abbreviation', function (editor, abbr, syntax, profile) {
		var info = require('editorUtils').outputInfo(editor, syntax, profile);
		var utils = require('utils');
		/** @type emmet.editorUtils */
		var editorUtils = require('editorUtils');
		var matcher = require('html_matcher');
		
		abbr = abbr || editor.prompt("Enter abbreviation");
		
		if (!abbr) 
			return null;
		
		abbr = String(abbr);
		
		var range = editor.getSelectionRange();
		var startOffset = range.start;
		var endOffset = range.end;
		
		if (startOffset == endOffset) {
			// no selection, find tag pair
			range = matcher(info.content, startOffset, info.profile);
			
			if (!range || range[0] == -1) // nothing to wrap
				return false;
			
			/** @type Range */
			var narrowedSel = utils.narrowToNonSpace(info.content, range[0], range[1] - range[0]);
			startOffset = narrowedSel.start;
			endOffset = narrowedSel.end;
		}
		
		var newContent = utils.escapeText(info.content.substring(startOffset, endOffset));
		var result = module
			.wrap(abbr, editorUtils.unindent(editor, newContent), info.syntax, 
					info.profile, require('actionUtils').captureContext(editor));
		
		if (result) {
			editor.replaceContent(result, startOffset, endOffset);
			return true;
		}
		
		return false;
	});
	
	return module = {
		/**
		 * Wraps passed text with abbreviation. Text will be placed inside last
		 * expanded element
		 * @memberOf wrapWithAbbreviation
		 * @param {String} abbr Abbreviation
		 * @param {String} text Text to wrap
		 * @param {String} syntax Document type (html, xml, etc.). Default is 'html'
		 * @param {String} profile Output profile's name. Default is 'plain'
		 * @param {Object} contextNode Context node inside which abbreviation
		 * is wrapped. It will be used as a reference for node name resolvers
		 * @return {String}
		 */
		wrap: function(abbr, text, syntax, profile, contextNode) {
			/** @type emmet.filters */
			var filters = require('filters');
			/** @type emmet.utils */
			var utils = require('utils');
			
			syntax = syntax || emmet.defaultSyntax();
			profile = require('profile').get(profile, syntax);
			
			require('tabStops').resetTabstopIndex();
			
			var data = filters.extractFromAbbreviation(abbr);
			var parsedTree = require('abbreviationParser').parse(data[0], {
				syntax: syntax,
				pastedContent: text,
				contextNode: contextNode
			});
			if (parsedTree) {
				var filtersList = filters.composeList(syntax, profile, data[1]);
				filters.apply(parsedTree, filtersList, profile);
				return utils.replaceVariables(parsedTree.toString());
			}
			
			return null;
		}
	};
});/**
 * Toggles HTML and CSS comments depending on current caret context. Unlike
 * the same action in most editors, this action toggles comment on currently
 * matched item—HTML tag or CSS selector—when nothing is selected.
 * 
 * @param {Function} require
 * @param {Underscore} _
 * @memberOf __toggleCommentAction
 * @constructor
 */
emmet.exec(function(require, _) {
	/**
	 * Toggle HTML comment on current selection or tag
	 * @param {IEmmetEditor} editor
	 * @return {Boolean} Returns <code>true</code> if comment was toggled
	 */
	function toggleHTMLComment(editor) {
		/** @type Range */
		var range = require('range').create(editor.getSelectionRange());
		var info = require('editorUtils').outputInfo(editor);
			
		if (!range.length()) {
			// no selection, find matching tag
			var pair = require('html_matcher').getTags(info.content, editor.getCaretPos(), info.profile);
			if (pair && pair[0]) { // found pair
				range.start = pair[0].start;
				range.end = pair[1] ? pair[1].end : pair[0].end;
			}
		}
		
		return genericCommentToggle(editor, '<!--', '-->', range);
	}

	/**
	 * Simple CSS commenting
	 * @param {IEmmetEditor} editor
	 * @return {Boolean} Returns <code>true</code> if comment was toggled
	 */
	function toggleCSSComment(editor) {
		/** @type Range */
		var range = require('range').create(editor.getSelectionRange());
		var info = require('editorUtils').outputInfo(editor);
			
		if (!range.length()) {
			// no selection, try to get current rule
			/** @type CSSRule */
			var rule = require('cssEditTree').parseFromPosition(info.content, editor.getCaretPos());
			if (rule) {
				var property = cssItemFromPosition(rule, editor.getCaretPos());
				range = property 
					? property.range(true) 
					: require('range').create(rule.nameRange(true).start, rule.source);
			}
		}
		
		if (!range.length()) {
			// still no selection, get current line
			range = require('range').create(editor.getCurrentLineRange());
			require('utils').narrowToNonSpace(info.content, range);
		}
		
		return genericCommentToggle(editor, '/*', '*/', range);
	}
	
	/**
	 * Returns CSS property from <code>rule</code> that matches passed position
	 * @param {EditContainer} rule
	 * @param {Number} absPos
	 * @returns {EditElement}
	 */
	function cssItemFromPosition(rule, absPos) {
		// do not use default EditContainer.itemFromPosition() here, because
		// we need to make a few assumptions to make CSS commenting more reliable
		var relPos = absPos - (rule.options.offset || 0);
		var reSafeChar = /^[\s\n\r]/;
		return _.find(rule.list(), function(item) {
			if (item.range().end === relPos) {
				// at the end of property, but outside of it
				// if there’s a space character at current position,
				// use current property
				return reSafeChar.test(rule.source.charAt(relPos));
			}
			
			return item.range().inside(relPos);
		});
	}

	/**
	 * Search for nearest comment in <code>str</code>, starting from index <code>from</code>
	 * @param {String} text Where to search
	 * @param {Number} from Search start index
	 * @param {String} start_token Comment start string
	 * @param {String} end_token Comment end string
	 * @return {Range} Returns null if comment wasn't found
	 */
	function searchComment(text, from, startToken, endToken) {
		var commentStart = -1;
		var commentEnd = -1;
		
		var hasMatch = function(str, start) {
			return text.substr(start, str.length) == str;
		};
			
		// search for comment start
		while (from--) {
			if (hasMatch(startToken, from)) {
				commentStart = from;
				break;
			}
		}
		
		if (commentStart != -1) {
			// search for comment end
			from = commentStart;
			var contentLen = text.length;
			while (contentLen >= from++) {
				if (hasMatch(endToken, from)) {
					commentEnd = from + endToken.length;
					break;
				}
			}
		}
		
		return (commentStart != -1 && commentEnd != -1) 
			? require('range').create(commentStart, commentEnd - commentStart) 
			: null;
	}

	/**
	 * Generic comment toggling routine
	 * @param {IEmmetEditor} editor
	 * @param {String} commentStart Comment start token
	 * @param {String} commentEnd Comment end token
	 * @param {Range} range Selection range
	 * @return {Boolean}
	 */
	function genericCommentToggle(editor, commentStart, commentEnd, range) {
		var editorUtils = require('editorUtils');
		var content = editorUtils.outputInfo(editor).content;
		var caretPos = editor.getCaretPos();
		var newContent = null;
		
		var utils = require('utils');
			
		/**
		 * Remove comment markers from string
		 * @param {Sting} str
		 * @return {String}
		 */
		function removeComment(str) {
			return str
				.replace(new RegExp('^' + utils.escapeForRegexp(commentStart) + '\\s*'), function(str){
					caretPos -= str.length;
					return '';
				}).replace(new RegExp('\\s*' + utils.escapeForRegexp(commentEnd) + '$'), '');
		}
		
		// first, we need to make sure that this substring is not inside 
		// comment
		var commentRange = searchComment(content, caretPos, commentStart, commentEnd);
		if (commentRange && commentRange.overlap(range)) {
			// we're inside comment, remove it
			range = commentRange;
			newContent = removeComment(range.substring(content));
		} else {
			// should add comment
			// make sure that there's no comment inside selection
			newContent = commentStart + ' ' +
				range.substring(content)
					.replace(new RegExp(utils.escapeForRegexp(commentStart) + '\\s*|\\s*' + utils.escapeForRegexp(commentEnd), 'g'), '') +
				' ' + commentEnd;
				
			// adjust caret position
			caretPos += commentStart.length + 1;
		}

		// replace editor content
		if (newContent !== null) {
			newContent = utils.escapeText(newContent);
			editor.setCaretPos(range.start);
			editor.replaceContent(editorUtils.unindent(editor, newContent), range.start, range.end);
			editor.setCaretPos(caretPos);
			return true;
		}
		
		return false;
	}
	
	/**
	 * Toggle comment on current editor's selection or HTML tag/CSS rule
	 * @param {IEmmetEditor} editor
	 */
	require('actions').add('toggle_comment', function(editor) {
		var info = require('editorUtils').outputInfo(editor);
		if (info.syntax == 'css') {
			// in case our editor is good enough and can recognize syntax from 
			// current token, we have to make sure that cursor is not inside
			// 'style' attribute of html element
			var caretPos = editor.getCaretPos();
			var pair = require('html_matcher').getTags(info.content, caretPos);
			if (pair && pair[0] && pair[0].type == 'tag' && 
					pair[0].start <= caretPos && pair[0].end >= caretPos) {
				info.syntax = 'html';
			}
		}
		
		if (info.syntax == 'css')
			return toggleCSSComment(editor);
		
		return toggleHTMLComment(editor);
	});
});/**
 * Move between next/prev edit points. 'Edit points' are places between tags 
 * and quotes of empty attributes in html
 * @constructor
 * 
 * @memberOf __editPointActionDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _) {
	/**
	 * Search for new caret insertion point
	 * @param {IEmmetEditor} editor Editor instance
	 * @param {Number} inc Search increment: -1 — search left, 1 — search right
	 * @param {Number} offset Initial offset relative to current caret position
	 * @return {Number} Returns -1 if insertion point wasn't found
	 */
	function findNewEditPoint(editor, inc, offset) {
		inc = inc || 1;
		offset = offset || 0;
		
		var curPoint = editor.getCaretPos() + offset;
		var content = String(editor.getContent());
		var maxLen = content.length;
		var nextPoint = -1;
		var reEmptyLine = /^\s+$/;
		
		function getLine(ix) {
			var start = ix;
			while (start >= 0) {
				var c = content.charAt(start);
				if (c == '\n' || c == '\r')
					break;
				start--;
			}
			
			return content.substring(start, ix);
		}
			
		while (curPoint <= maxLen && curPoint >= 0) {
			curPoint += inc;
			var curChar = content.charAt(curPoint);
			var nextChar = content.charAt(curPoint + 1);
			var prevChar = content.charAt(curPoint - 1);
				
			switch (curChar) {
				case '"':
				case '\'':
					if (nextChar == curChar && prevChar == '=') {
						// empty attribute
						nextPoint = curPoint + 1;
					}
					break;
				case '>':
					if (nextChar == '<') {
						// between tags
						nextPoint = curPoint + 1;
					}
					break;
				case '\n':
				case '\r':
					// empty line
					if (reEmptyLine.test(getLine(curPoint - 1))) {
						nextPoint = curPoint;
					}
					break;
			}
			
			if (nextPoint != -1)
				break;
		}
		
		return nextPoint;
	}
	
	/** @type emmet.actions */
	var actions = require('actions');
	
	/**
	 * Move caret to previous edit point
	 * @param {IEmmetEditor} editor Editor instance
	 */
	actions.add('prev_edit_point', function(editor) {
		var curPos = editor.getCaretPos();
		var newPoint = findNewEditPoint(editor, -1);
			
		if (newPoint == curPos)
			// we're still in the same point, try searching from the other place
			newPoint = findNewEditPoint(editor, -1, -2);
		
		if (newPoint != -1) {
			editor.setCaretPos(newPoint);
			return true;
		}
		
		return false;
	}, {label: 'Previous Edit Point'});
	
	/**
	 * Move caret to next edit point
	 * @param {IEmmetEditor} editor Editor instance
	 */
	actions.add('next_edit_point', function(editor) {
		var newPoint = findNewEditPoint(editor, 1);
		if (newPoint != -1)
			editor.setCaretPos(newPoint);
	});
});/**
 * Actions that use stream parsers and tokenizers for traversing:
 * -- Search for next/previous items in HTML
 * -- Search for next/previous items in CSS
 * @constructor
 * @memberOf __selectItemActionDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _) {
	var startTag = /^<([\w\:\-]+)((?:\s+[\w\-:]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/;
	
	/**
	 * Generic function for searching for items to select
	 * @param {IEmmetEditor} editor
	 * @param {Boolean} isBackward Search backward (search forward otherwise)
	 * @param {Function} extractFn Function that extracts item content
	 * @param {Function} rangeFn Function that search for next token range
	 */
	function findItem(editor, isBackward, extractFn, rangeFn) {
		var range = require('range');
		var content = require('editorUtils').outputInfo(editor).content;
		
		var contentLength = content.length;
		var itemRange, rng;
		/** @type Range */
		var prevRange = range.create(-1, 0);
		/** @type Range */
		var sel = range.create(editor.getSelectionRange());
		
		var searchPos = sel.start, loop = 100000; // endless loop protection
		while (searchPos >= 0 && searchPos < contentLength && --loop > 0) {
			if ( (itemRange = extractFn(content, searchPos, isBackward)) ) {
				if (prevRange.equal(itemRange)) {
					break;
				}
				
				prevRange = itemRange.clone();
				rng = rangeFn(itemRange.substring(content), itemRange.start, sel.clone());
				
				if (rng) {
					editor.createSelection(rng.start, rng.end);
					return true;
				} else {
					searchPos = isBackward ? itemRange.start : itemRange.end - 1;
				}
			}
			
			searchPos += isBackward ? -1 : 1;
		}
		
		return false;
	}
	
	// XXX HTML section
	
	/**
	 * Find next HTML item
	 * @param {IEmmetEditor} editor
	 */
	function findNextHTMLItem(editor) {
		var isFirst = true;
		return findItem(editor, false, function(content, searchPos){
			if (isFirst) {
				isFirst = false;
				return findOpeningTagFromPosition(content, searchPos);
			} else {
				return getOpeningTagFromPosition(content, searchPos);
			}
		}, function(tag, offset, selRange) {
			return getRangeForHTMLItem(tag, offset, selRange, false);
		});
	}
	
	/**
	 * Find previous HTML item
	 * @param {IEmmetEditor} editor
	 */
	function findPrevHTMLItem(editor) {
		return findItem(editor, true, getOpeningTagFromPosition, function (tag, offset, selRange) {
			return getRangeForHTMLItem(tag, offset, selRange, true);
		});
	}
	
	/**
	 * Creates possible selection ranges for HTML tag
	 * @param {String} source Original HTML source for tokens
	 * @param {Array} tokens List of HTML tokens
	 * @returns {Array}
	 */
	function makePossibleRangesHTML(source, tokens, offset) {
		offset = offset || 0;
		var range = require('range');
		var result = [];
		var attrStart = -1, attrName = '', attrValue = '', attrValueRange, tagName;
		_.each(tokens, function(tok) {
			switch (tok.type) {
				case 'tag':
					tagName = source.substring(tok.start, tok.end);
					if (/^<[\w\:\-]/.test(tagName)) {
						// add tag name
						result.push(range.create({
							start: tok.start + 1, 
							end: tok.end
						}));
					}
					break;
				case 'attribute':
					attrStart = tok.start;
					attrName = source.substring(tok.start, tok.end);
					break;
					
				case 'string':
					// attribute value
					// push full attribute first
					 result.push(range.create(attrStart, tok.end - attrStart));
					 
					 attrValueRange = range.create(tok);
					 attrValue = attrValueRange.substring(source);
					 
					 // is this a quoted attribute?
					 if (isQuote(attrValue.charAt(0)))
						 attrValueRange.start++;
					 
					 if (isQuote(attrValue.charAt(attrValue.length - 1)))
						 attrValueRange.end--;
					 
					 result.push(attrValueRange);
					 
					 if (attrName == 'class') {
						 result = result.concat(classNameRanges(attrValueRange.substring(source), attrValueRange.start));
					 }
					 
					break;
			}
		});
		
		// offset ranges
		_.each(result, function(r) {
			r.shift(offset);
		});
		
		return _.chain(result)
			.filter(function(item) {        // remove empty
				return !!item.length();
			})
			.uniq(false, function(item) {   // remove duplicates
				return item.toString();
			})
			.value();
	}
	
	/**
	 * Returns ranges of class names in "class" attribute value
	 * @param {String} className
	 * @returns {Array}
	 */
	function classNameRanges(className, offset) {
		offset = offset || 0;
		var result = [];
		/** @type StringStream */
		var stream = require('stringStream').create(className);
		var range = require('range');
		
		// skip whitespace
		stream.eatSpace();
		stream.start = stream.pos;
		
		var ch;
		while (ch = stream.next()) {
			if (/[\s\u00a0]/.test(ch)) {
				result.push(range.create(stream.start + offset, stream.pos - stream.start - 1));
				stream.eatSpace();
				stream.start = stream.pos;
			}
		}
		
		result.push(range.create(stream.start + offset, stream.pos - stream.start));
		return result;
	}
	
	/**
	 * Returns best HTML tag range match for current selection
	 * @param {String} tag Tag declaration
	 * @param {Number} offset Tag's position index inside content
	 * @param {Range} selRange Selection range
	 * @return {Range} Returns range if next item was found, <code>null</code> otherwise
	 */
	function getRangeForHTMLItem(tag, offset, selRange, isBackward) {
		var ranges = makePossibleRangesHTML(tag, require('xmlParser').parse(tag), offset);
		
		if (isBackward)
			ranges.reverse();
		
		// try to find selected range
		var curRange = _.find(ranges, function(r) {
			return r.equal(selRange);
		});
		
		if (curRange) {
			var ix = _.indexOf(ranges, curRange);
			if (ix < ranges.length - 1)
				return ranges[ix + 1];
			
			return null;
		}
		
		// no selected range, find nearest one
		if (isBackward)
			// search backward
			return _.find(ranges, function(r) {
				return r.start < selRange.start;
			});
		
		// search forward
		// to deal with overlapping ranges (like full attribute definition
		// and attribute value) let's find range under caret first
		if (!curRange) {
			var matchedRanges = _.filter(ranges, function(r) {
				return r.inside(selRange.end);
			});
			
			if (matchedRanges.length > 1)
				return matchedRanges[1];
		}
		
		
		return _.find(ranges, function(r) {
			return r.end > selRange.end;
		});
	}
	
	/**
	 * Search for opening tag in content, starting at specified position
	 * @param {String} html Where to search tag
	 * @param {Number} pos Character index where to start searching
	 * @return {Range} Returns range if valid opening tag was found,
	 * <code>null</code> otherwise
	 */
	function findOpeningTagFromPosition(html, pos) {
		var tag;
		while (pos >= 0) {
			if (tag = getOpeningTagFromPosition(html, pos))
				return tag;
			pos--;
		}
		
		return null;
	}
	
	/**
	 * @param {String} html Where to search tag
	 * @param {Number} pos Character index where to start searching
	 * @return {Range} Returns range if valid opening tag was found,
	 * <code>null</code> otherwise
	 */
	function getOpeningTagFromPosition(html, pos) {
		var m;
		if (html.charAt(pos) == '<' && (m = html.substring(pos, html.length).match(startTag))) {
			return require('range').create(pos, m[0]);
		}
	}
	
	function isQuote(ch) {
		return ch == '"' || ch == "'";
	}
	
	/**
	 * Makes all possible selection ranges for specified CSS property
	 * @param {CSSProperty} property
	 * @returns {Array}
	 */
	function makePossibleRangesCSS(property) {
		// find all possible ranges, sorted by position and size
		var valueRange = property.valueRange(true);
		var result = [property.range(true), valueRange];
		var stringStream = require('stringStream');
		var cssEditTree = require('cssEditTree');
		var range = require('range');
		
		// locate parts of complex values.
		// some examples:
		// – 1px solid red: 3 parts
		// – arial, sans-serif: enumeration, 2 parts
		// – url(image.png): function value part
		var value = property.value();
		_.each(property.valueParts(), function(r) {
			// add absolute range
			var clone = r.clone();
			result.push(clone.shift(valueRange.start));
			
			/** @type StringStream */
			var stream = stringStream.create(r.substring(value));
			if (stream.match(/^[\w\-]+\(/, true)) {
				// we have a function, find values in it.
				// but first add function contents
				stream.start = stream.pos;
				stream.skipToPair('(', ')');
				var fnBody = stream.current();
				result.push(range.create(clone.start + stream.start, fnBody));
				
				// find parts
				_.each(cssEditTree.findParts(fnBody), function(part) {
					result.push(range.create(clone.start + stream.start + part.start, part.substring(fnBody)));
				});
			}
		});
		
		// optimize result: remove empty ranges and duplicates
		return _.chain(result)
			.filter(function(item) {
				return !!item.length();
			})
			.uniq(false, function(item) {
				return item.toString();
			})
			.value();
	}
	
	/**
	 * Tries to find matched CSS property and nearest range for selection
	 * @param {CSSRule} rule
	 * @param {Range} selRange
	 * @param {Boolean} isBackward
	 * @returns {Range}
	 */
	function matchedRangeForCSSProperty(rule, selRange, isBackward) {
		/** @type CSSProperty */
		var property = null;
		var possibleRanges, curRange = null, ix;
		var list = rule.list();
		var searchFn, nearestItemFn;
		
		if (isBackward) {
			list.reverse();
			searchFn = function(p) {
				return p.range(true).start <= selRange.start;
			};
			nearestItemFn = function(r) {
				return r.start < selRange.start;
			};
		} else {
			searchFn = function(p) {
				return p.range(true).end >= selRange.end;
			};
			nearestItemFn = function(r) {
				return r.end > selRange.start;
			};
		}
		
		// search for nearest to selection CSS property
		while (property = _.find(list, searchFn)) {
			possibleRanges = makePossibleRangesCSS(property);
			if (isBackward)
				possibleRanges.reverse();
			
			// check if any possible range is already selected
			curRange = _.find(possibleRanges, function(r) {
				return r.equal(selRange);
			});
			
			if (!curRange) {
				// no selection, select nearest item
				var matchedRanges = _.filter(possibleRanges, function(r) {
					return r.inside(selRange.end);
				});
				
				if (matchedRanges.length > 1) {
					curRange = matchedRanges[1];
					break;
				}
				
				if (curRange = _.find(possibleRanges, nearestItemFn))
					break;
			} else {
				ix = _.indexOf(possibleRanges, curRange);
				if (ix != possibleRanges.length - 1) {
					curRange = possibleRanges[ix + 1];
					break;
				}
			}
			
			curRange = null;
			selRange.start = selRange.end = isBackward 
				? property.range(true).start - 1
				: property.range(true).end + 1;
		}
		
		return curRange;
	}
	
	function findNextCSSItem(editor) {
		return findItem(editor, false, require('cssEditTree').extractRule, getRangeForNextItemInCSS);
	}
	
	function findPrevCSSItem(editor) {
		return findItem(editor, true, require('cssEditTree').extractRule, getRangeForPrevItemInCSS);
	}
	
	/**
	 * Returns range for item to be selected in CSS after current caret 
	 * (selection) position
	 * @param {String} rule CSS rule declaration
	 * @param {Number} offset Rule's position index inside content
	 * @param {Range} selRange Selection range
	 * @return {Range} Returns range if next item was found, <code>null</code> otherwise
	 */
	function getRangeForNextItemInCSS(rule, offset, selRange) {
		var tree = require('cssEditTree').parse(rule, {
			offset: offset
		});
		
		// check if selector is matched
		var range = tree.nameRange(true);
		if (selRange.end < range.end) {
			return range;
		}
		
		return matchedRangeForCSSProperty(tree, selRange, false);
	}
	
	/**
	 * Returns range for item to be selected in CSS before current caret 
	 * (selection) position
	 * @param {String} rule CSS rule declaration
	 * @param {Number} offset Rule's position index inside content
	 * @param {Range} selRange Selection range
	 * @return {Range} Returns range if previous item was found, <code>null</code> otherwise
	 */
	function getRangeForPrevItemInCSS(rule, offset, selRange) {
		var tree = require('cssEditTree').parse(rule, {
			offset: offset
		});
		
		var curRange = matchedRangeForCSSProperty(tree, selRange, true);
		
		if (!curRange) {
			// no matched property, try to match selector
			var range = tree.nameRange(true);
			if (selRange.start > range.start) {
				return range;
			}
		}
		
		return curRange;
	}
	
	// XXX register actions
	var actions = require('actions');
	actions.add('select_next_item', function(editor){
		if (editor.getSyntax() == 'css')
			return findNextCSSItem(editor);
		else
			return findNextHTMLItem(editor);
	});
	
	actions.add('select_previous_item', function(editor){
		if (editor.getSyntax() == 'css')
			return findPrevCSSItem(editor);
		else
			return findPrevHTMLItem(editor);
	});
});/**
 * HTML pair matching (balancing) actions
 * @constructor
 * @memberOf __matchPairActionDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _) {
	/** @type emmet.actions */
	var actions = require('actions');
	var matcher = require('html_matcher');
	
	/**
	 * Find and select HTML tag pair
	 * @param {IEmmetEditor} editor Editor instance
	 * @param {String} direction Direction of pair matching: 'in' or 'out'. 
	 * Default is 'out'
	 */
	function matchPair(editor, direction, syntax) {
		direction = String((direction || 'out').toLowerCase());
		var info = require('editorUtils').outputInfo(editor, syntax);
		syntax = info.syntax;
		
		var range = require('range');
		/** @type Range */
		var selRange = range.create(editor.getSelectionRange());
		var content = info.content;
		/** @type Range */
		var tagRange = null;
		/** @type Range */
		var _r;
		
		var oldOpenTag = matcher.last_match['opening_tag'];
		var oldCloseTag = matcher.last_match['closing_tag'];
			
		if (direction == 'in' && oldOpenTag && selRange.length()) {
//			user has previously selected tag and wants to move inward
			if (!oldCloseTag) {
//				unary tag was selected, can't move inward
				return false;
			} else if (oldOpenTag.start == selRange.start) {
				if (content.charAt(oldOpenTag.end) == '<') {
//					test if the first inward tag matches the entire parent tag's content
					_r = range.create(matcher.find(content, oldOpenTag.end + 1, syntax));
					if (_r.start == oldOpenTag.end && _r.end == oldCloseTag.start) {
						tagRange = range.create(matcher(content, oldOpenTag.end + 1, syntax));
					} else {
						tagRange = range.create(oldOpenTag.end, oldCloseTag.start - oldOpenTag.end);
					}
				} else {
					tagRange = range.create(oldOpenTag.end, oldCloseTag.start - oldOpenTag.end);
				}
			} else {
				var newCursor = content.substring(0, oldCloseTag.start).indexOf('<', oldOpenTag.end);
				var searchPos = newCursor != -1 ? newCursor + 1 : oldOpenTag.end;
				tagRange = range.create(matcher(content, searchPos, syntax));
			}
		} else {
			tagRange = range.create(matcher(content, selRange.end, syntax));
		}
		
		if (tagRange && tagRange.start != -1) {
			editor.createSelection(tagRange.start, tagRange.end);
			return true;
		}
		
		return false;
	}
	
	actions.add('match_pair', matchPair, {hidden: true});
	actions.add('match_pair_inward', function(editor){
		return matchPair(editor, 'in');
	}, {label: 'HTML/Match Pair Tag (inward)'});

	actions.add('match_pair_outward', function(editor){
		return matchPair(editor, 'out');
	}, {label: 'HTML/Match Pair Tag (outward)'});
	
	/**
	 * Moves caret to matching opening or closing tag
	 * @param {IEmmetEditor} editor
	 */
	actions.add('matching_pair', function(editor) {
		var content = String(editor.getContent());
		var caretPos = editor.getCaretPos();
		
		if (content.charAt(caretPos) == '<') 
			// looks like caret is outside of tag pair  
			caretPos++;
			
		var tags = matcher.getTags(content, caretPos, String(editor.getProfileName()));
			
		if (tags && tags[0]) {
			// match found
			var openTag = tags[0];
			var closeTag = tags[1];
				
			if (closeTag) { // exclude unary tags
				if (openTag.start <= caretPos && openTag.end >= caretPos) {
					editor.setCaretPos(closeTag.start);
					return true;
				} else if (closeTag.start <= caretPos && closeTag.end >= caretPos){
					editor.setCaretPos(openTag.start);
					return true;
				}
			}
		}
		
		return false;
	}, {label: 'HTML/Go To Matching Tag Pair'});
});/**
 * Gracefully removes tag under cursor
 * 
 * @param {Function} require
 * @param {Underscore} _ 
 */
emmet.exec(function(require, _) {
	require('actions').add('remove_tag', function(editor) {
		var utils = require('utils');
		var info = require('editorUtils').outputInfo(editor);
		
		// search for tag
		var pair = require('html_matcher').getTags(info.content, editor.getCaretPos(), info.profile);
		if (pair && pair[0]) {
			if (!pair[1]) {
				// simply remove unary tag
				editor.replaceContent(utils.getCaretPlaceholder(), pair[0].start, pair[0].end);
			} else {
				// remove tag and its newlines
				/** @type Range */
				var tagContentRange = utils.narrowToNonSpace(info.content, pair[0].end, pair[1].start - pair[0].end);
				/** @type Range */
				var startLineBounds = utils.findNewlineBounds(info.content, tagContentRange.start);
				var startLinePad = utils.getLinePadding(startLineBounds.substring(info.content));
				var tagContent = tagContentRange.substring(info.content);
				
				tagContent = utils.unindentString(tagContent, startLinePad);
				editor.replaceContent(utils.getCaretPlaceholder() + utils.escapeText(tagContent), pair[0].start, pair[1].end);
			}
			
			return true;
		}
		
		return false;
	}, {label: 'HTML/Remove Tag'});
});
/**
 * Splits or joins tag, e.g. transforms it into a short notation and vice versa:<br>
 * &lt;div&gt;&lt;/div&gt; → &lt;div /&gt; : join<br>
 * &lt;div /&gt; → &lt;div&gt;&lt;/div&gt; : split
 * @param {Function} require
 * @param {Underscore} _
 * @memberOf __splitJoinTagAction
 * @constructor
 */
emmet.exec(function(require, _) {
	/**
	 * @param {IEmmetEditor} editor
	 * @param {Object} profile
	 * @param {Object} htmlMatch
	 */
	function joinTag(editor, profile, htmlMatch) {
		/** @type emmet.utils */
		var utils = require('utils');
		
		var closingSlash = (profile.self_closing_tag === true) ? '/' : ' /';
		var content = htmlMatch[0].full_tag.replace(/\s*>$/, closingSlash + '>');
		
		// add caret placeholder
		if (content.length + htmlMatch[0].start < editor.getCaretPos())
			content += utils.getCaretPlaceholder();
		else {
			var d = editor.getCaretPos() - htmlMatch[0].start;
			content = utils.replaceSubstring(content, utils.getCaretPlaceholder(), d);
		}
		
		editor.replaceContent(content, htmlMatch[0].start, htmlMatch[1].end);
		return true;
	}
	
	function splitTag(editor, profile, htmlMatch) {
		/** @type emmet.utils */
		var utils = require('utils');
		
		var nl = utils.getNewline();
		var pad = require('resources').getVariable('indentation');
		var caret = utils.getCaretPlaceholder();
		
		// define tag content depending on profile
		var tagContent = (profile.tag_nl === true) ? nl + pad + caret + nl : caret;
				
		var content = htmlMatch[0].full_tag.replace(/\s*\/>$/, '>') + tagContent + '</' + htmlMatch[0].name + '>';
		editor.replaceContent(content, htmlMatch[0].start, htmlMatch[0].end);
		return true;
	}
	
	require('actions').add('split_join_tag', function(editor, profileName) {
		var matcher = require('html_matcher');
		
		var info = require('editorUtils').outputInfo(editor, null, profileName);
		var profile = require('profile').get(info.profile);
		
		// find tag at current position
		var pair = matcher.getTags(info.content, editor.getCaretPos(), info.profile);
		if (pair && pair[0]) {
			if (pair[1]) { // join tag
				return joinTag(editor, profile, pair);
			}
			return splitTag(editor, profile, pair);
		}
		
		return false;
	}, {label: 'HTML/Split\\Join Tag Declaration'});
});/**
 * Reflect CSS value: takes rule's value under caret and pastes it for the same 
 * rules with vendor prefixes
 * @constructor
 * @memberOf __reflectCSSActionDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.define('reflectCSSValue', function(require, _) {
	/**
	 * @type HandlerList List of registered handlers
	 */
	var handlers = require('handlerList').create();
	
	require('actions').add('reflect_css_value', function(editor) {
		if (editor.getSyntax() != 'css') return false;
		
		return require('actionUtils').compoundUpdate(editor, doCSSReflection(editor));
	}, {label: 'CSS/Reflect Value'});
	
	function doCSSReflection(editor) {
		/** @type emmet.cssEditTree */
		var cssEditTree = require('cssEditTree');
		var outputInfo = require('editorUtils').outputInfo(editor);
		var caretPos = editor.getCaretPos();
		
		var cssRule = cssEditTree.parseFromPosition(outputInfo.content, caretPos);
		if (!cssRule) return;
		
		var property = cssRule.itemFromPosition(caretPos, true);
		// no property under cursor, nothing to reflect
		if (!property) return;
		
		var oldRule = cssRule.source;
		var offset = cssRule.options.offset;
		var caretDelta = caretPos - offset - property.range().start;
		
		handlers.exec(false, [property]);
		
		if (oldRule !== cssRule.source) {
			return {
				data:  cssRule.source,
				start: offset,
				end:   offset + oldRule.length,
				caret: offset + property.range().start + caretDelta
			};
		}
	}
	
	/**
	 * Returns regexp that should match reflected CSS property names
	 * @param {String} name Current CSS property name
	 * @return {RegExp}
	 */
	function getReflectedCSSName(name) {
		name = require('cssEditTree').baseName(name);
		var vendorPrefix = '^(?:\\-\\w+\\-)?', m;
		
		if (name == 'opacity' || name == 'filter') {
			return new RegExp(vendorPrefix + '(?:opacity|filter)$');
		} else if (m = name.match(/^border-radius-(top|bottom)(left|right)/)) {
			// Mozilla-style border radius
			return new RegExp(vendorPrefix + '(?:' + name + '|border-' + m[1] + '-' + m[2] + '-radius)$');
		} else if (m = name.match(/^border-(top|bottom)-(left|right)-radius/)) { 
			return new RegExp(vendorPrefix + '(?:' + name + '|border-radius-' + m[1] + m[2] + ')$');
		}
		
		return new RegExp(vendorPrefix + name + '$');
	}
	
	/**
	 * Reflects value from <code>donor</code> into <code>receiver</code>
	 * @param {CSSProperty} donor Donor CSS property from which value should
	 * be reflected
	 * @param {CSSProperty} receiver Property that should receive reflected 
	 * value from donor
	 */
	function reflectValue(donor, receiver) {
		var value = getReflectedValue(donor.name(), donor.value(), 
				receiver.name(), receiver.value());
		
		receiver.value(value);
	}
	
	/**
	 * Returns value that should be reflected for <code>refName</code> CSS property
	 * from <code>curName</code> property. This function is used for special cases,
	 * when the same result must be achieved with different properties for different
	 * browsers. For example: opаcity:0.5; → filter:alpha(opacity=50);<br><br>
	 * 
	 * This function does value conversion between different CSS properties
	 * 
	 * @param {String} curName Current CSS property name
	 * @param {String} curValue Current CSS property value
	 * @param {String} refName Receiver CSS property's name 
	 * @param {String} refValue Receiver CSS property's value
	 * @return {String} New value for receiver property
	 */
	function getReflectedValue(curName, curValue, refName, refValue) {
		var cssEditTree = require('cssEditTree');
		var utils = require('utils');
		curName = cssEditTree.baseName(curName);
		refName = cssEditTree.baseName(refName);
		
		if (curName == 'opacity' && refName == 'filter') {
			return refValue.replace(/opacity=[^)]*/i, 'opacity=' + Math.floor(parseFloat(curValue) * 100));
		} else if (curName == 'filter' && refName == 'opacity') {
			var m = curValue.match(/opacity=([^)]*)/i);
			return m ? utils.prettifyNumber(parseInt(m[1]) / 100) : refValue;
		}
		
		return curValue;
	}
	
	// XXX add default handler
	handlers.add(function(property) {
		var reName = getReflectedCSSName(property.name());
		_.each(property.parent.list(), function(p) {
			if (reName.test(p.name())) {
				reflectValue(property, p);
			}
		});
	}, {order: -1});
	
	return {
		/**
		 * Adds custom reflect handler. The passed function will receive matched
		 * CSS property (as <code>CSSEditElement</code> object) and should
		 * return <code>true</code> if it was performed successfully (handled 
		 * reflection), <code>false</code> otherwise.
		 * @param {Function} fn
		 * @param {Object} options
		 */
		addHandler: function(fn, options) {
			handlers.add(fn, options);
		},
		
		/**
		 * Removes registered handler
		 * @returns
		 */
		removeHandler: function(fn) {
			handlers.remove(fn, options);
		}
	};
});/**
 * Evaluates simple math expression under caret
 * @param {Function} require
 * @param {Underscore} _ 
 */
emmet.exec(function(require, _) {
	require('actions').add('evaluate_math_expression', function(editor) {
		var actionUtils = require('actionUtils');
		var utils = require('utils');
		
		var content = String(editor.getContent());
		var chars = '.+-*/\\';
		
		/** @type Range */
		var sel = require('range').create(editor.getSelectionRange());
		if (!sel.length()) {
			sel = actionUtils.findExpressionBounds(editor, function(ch) {
				return utils.isNumeric(ch) || chars.indexOf(ch) != -1;
			});
		}
		
		if (sel && sel.length()) {
			var expr = sel.substring(content);
			
			// replace integral division: 11\2 => Math.round(11/2) 
			expr = expr.replace(/([\d\.\-]+)\\([\d\.\-]+)/g, 'Math.round($1/$2)');
			
			try {
				var result = utils.prettifyNumber(new Function('return ' + expr)());
				editor.replaceContent(result, sel.start, sel.end);
				editor.setCaretPos(sel.start + result.length);
				return true;
			} catch (e) {}
		}
		
		return false;
	}, {label: 'Numbers/Evaluate Math Expression'});
});
/**
 * Increment/decrement number under cursor
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _) {
	/**
	 * Extract number from current caret position of the <code>editor</code> and
	 * increment it by <code>step</code>
	 * @param {IEmmetEditor} editor
	 * @param {Number} step Increment step (may be negative)
	 */
	function incrementNumber(editor, step) {
		var utils = require('utils');
		var actionUtils = require('actionUtils');
		
		var hasSign = false;
		var hasDecimal = false;
			
		var r = actionUtils.findExpressionBounds(editor, function(ch, pos, content) {
			if (utils.isNumeric(ch))
				return true;
			if (ch == '.') {
				// make sure that next character is numeric too
				if (!utils.isNumeric(content.charAt(pos + 1)))
					return false;
				
				return hasDecimal ? false : hasDecimal = true;
			}
			if (ch == '-')
				return hasSign ? false : hasSign = true;
				
			return false;
		});
			
		if (r && r.length()) {
			var strNum = r.substring(String(editor.getContent()));
			var num = parseFloat(strNum);
			if (!_.isNaN(num)) {
				num = utils.prettifyNumber(num + step);
				
				// do we have zero-padded number?
				if (/^(\-?)0+[1-9]/.test(strNum)) {
					var minus = '';
					if (RegExp.$1) {
						minus = '-';
						num = num.substring(1);
					}
						
					var parts = num.split('.');
					parts[0] = utils.zeroPadString(parts[0], intLength(strNum));
					num = minus + parts.join('.');
				}
				
				editor.replaceContent(num, r.start, r.end);
				editor.createSelection(r.start, r.start + num.length);
				return true;
			}
		}
		
		return false;
	}
	
	/**
	 * Returns length of integer part of number
	 * @param {String} num
	 */
	function intLength(num) {
		num = num.replace(/^\-/, '');
		if (~num.indexOf('.')) {
			return num.split('.')[0].length;
		}
		
		return num.length;
	}
	
	var actions = require('actions');
	_.each([1, -1, 10, -10, 0.1, -0.1], function(num) {
		var prefix = num > 0 ? 'increment' : 'decrement';
		
		actions.add(prefix + '_number_by_' + String(Math.abs(num)).replace('.', '').substring(0, 2), function(editor) {
			return incrementNumber(editor, num);
		}, {label: 'Numbers/' + prefix.charAt(0).toUpperCase() + prefix.substring(1) + ' number by ' + Math.abs(num)});
	});
});/**
 * Actions to insert line breaks. Some simple editors (like browser's 
 * &lt;textarea&gt;, for example) do not provide such simple things
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _) {
	var actions = require('actions');
	/** @type emmet.preferences */
	var prefs = require('preferences');
	
	// setup default preferences
	prefs.define('css.closeBraceIndentation', '\n',
			'Indentation before closing brace of CSS rule. Some users prefere ' 
			+ 'indented closing brace of CSS rule for better readability. '
			+ 'This preference’s value will be automatically inserted before '
			+ 'closing brace when user adds newline in newly created CSS rule '
			+ '(e.g. when “Insert formatted linebreak” action will be performed ' 
			+ 'in CSS file). If you’re such user, you may want to write put a value ' 
			+ 'like <code>\\n\\t</code> in this preference.');
	
	/**
	 * Inserts newline character with proper indentation in specific positions only.
	 * @param {IEmmetEditor} editor
	 * @return {Boolean} Returns <code>true</code> if line break was inserted 
	 */
	actions.add('insert_formatted_line_break_only', function(editor) {
		var utils = require('utils');
		/** @type emmet.resources */
		var res = require('resources');
		
		var info = require('editorUtils').outputInfo(editor);
		var caretPos = editor.getCaretPos();
		var nl = utils.getNewline();
		
		if (_.include(['html', 'xml', 'xsl'], info.syntax)) {
			var pad = res.getVariable('indentation');
			// let's see if we're breaking newly created tag
			var pair = require('html_matcher').getTags(info.content, caretPos, info.profile);
			
			if (pair[0] && pair[1] && pair[0].type == 'tag' && pair[0].end == caretPos && pair[1].start == caretPos) {
				editor.replaceContent(nl + pad + utils.getCaretPlaceholder() + nl, caretPos);
				return true;
			}
		} else if (info.syntax == 'css') {
			/** @type String */
			var content = info.content;
			if (caretPos && content.charAt(caretPos - 1) == '{') {
				var append = prefs.get('css.closeBraceIndentation');
				var pad = res.getVariable('indentation');
				
				var hasCloseBrace = content.charAt(caretPos) == '}';
				if (!hasCloseBrace) {
					// do we really need special formatting here?
					// check if this is really a newly created rule,
					// look ahead for a closing brace
					for (var i = caretPos, il = content.length, ch; i < il; i++) {
						ch = content.charAt(i);
						if (ch == '{') {
							// ok, this is a new rule without closing brace
							break;
						}
						
						if (ch == '}') {
							// not a new rule, just add indentation
							append = '';
							hasCloseBrace = true;
							break;
						}
					}
				}
				
				if (!hasCloseBrace) {
					append += '}';
				}
				
				// defining rule set
				var insValue = nl + pad + utils.getCaretPlaceholder() + append;
				editor.replaceContent(insValue, caretPos);
				return true;
			}
		}
			
		return false;
	}, {hidden: true});
	
	/**
	 * Inserts newline character with proper indentation. This action is used in
	 * editors that doesn't have indentation control (like textarea element) to 
	 * provide proper indentation
	 * @param {IEmmetEditor} editor Editor instance
	 */
	actions.add('insert_formatted_line_break', function(editor) {
		if (!actions.run('insert_formatted_line_break_only', editor)) {
			var utils = require('utils');
			
			var curPadding = require('editorUtils').getCurrentLinePadding(editor);
			var content = String(editor.getContent());
			var caretPos = editor.getCaretPos();
			var len = content.length;
			var nl = utils.getNewline();
				
			// check out next line padding
			var lineRange = editor.getCurrentLineRange();
			var nextPadding = '';
				
			for (var i = lineRange.end + 1, ch; i < len; i++) {
				ch = content.charAt(i);
				if (ch == ' ' || ch == '\t')
					nextPadding += ch;
				else
					break;
			}
			
			if (nextPadding.length > curPadding.length)
				editor.replaceContent(nl + nextPadding, caretPos, caretPos, true);
			else
				editor.replaceContent(nl, caretPos);
		}
		
		return true;
	}, {hidden: true});
});/**
 * Merges selected lines or lines between XHTML tag pairs
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _) {
	require('actions').add('merge_lines', function(editor) {
		var matcher = require('html_matcher');
		var utils = require('utils');
		var editorUtils = require('editorUtils');
		var info = editorUtils.outputInfo(editor);
		
		/** @type Range */
		var selection = require('range').create(editor.getSelectionRange());
		if (!selection.length()) {
			// find matching tag
			var pair = matcher(info.content, editor.getCaretPos(), info.profile);
			if (pair) {
				selection.start = pair[0];
				selection.end = pair[1];
			}
		}
		
		if (selection.length()) {
			// got range, merge lines
			var text =  selection.substring(info.content);
			var lines = utils.splitByLines(text);
			
			for (var i = 1; i < lines.length; i++) {
				lines[i] = lines[i].replace(/^\s+/, '');
			}
			
			text = lines.join('').replace(/\s{2,}/, ' ');
			editor.replaceContent(text, selection.start, selection.end);
			editor.createSelection(selection.start, selection.start + text.length);
			
			return true;
		}
		
		return false;
	});
});/**
 * Encodes/decodes image under cursor to/from base64
 * @param {IEmmetEditor} editor
 * @since 0.65
 * 
 * @memberOf __base64ActionDefine
 * @constructor
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _) {
	require('actions').add('encode_decode_data_url', function(editor) {
		var data = String(editor.getSelection());
		var caretPos = editor.getCaretPos();
			
		if (!data) {
			// no selection, try to find image bounds from current caret position
			var text = String(editor.getContent()),  m;
			while (caretPos-- >= 0) {
				if (startsWith('src=', text, caretPos)) { // found <img src="">
					if (m = text.substr(caretPos).match(/^(src=(["'])?)([^'"<>\s]+)\1?/)) {
						data = m[3];
						caretPos += m[1].length;
					}
					break;
				} else if (startsWith('url(', text, caretPos)) { // found CSS url() pattern
					if (m = text.substr(caretPos).match(/^(url\((['"])?)([^'"\)\s]+)\1?/)) {
						data = m[3];
						caretPos += m[1].length;
					}
					break;
				}
			}
		}
		
		if (data) {
			if (startsWith('data:', data))
				return decodeFromBase64(editor, data, caretPos);
			else
				return encodeToBase64(editor, data, caretPos);
		}
		
		return false;
	}, {label: 'Encode\\Decode data:URL image'});
	
	/**
	 * Test if <code>text</code> starts with <code>token</code> at <code>pos</code>
	 * position. If <code>pos</code> is omitted, search from beginning of text 
	 * @param {String} token Token to test
	 * @param {String} text Where to search
	 * @param {Number} pos Position where to start search
	 * @return {Boolean}
	 * @since 0.65
	 */
	function startsWith(token, text, pos) {
		pos = pos || 0;
		return text.charAt(pos) == token.charAt(0) && text.substr(pos, token.length) == token;
	}
	
	/**
	 * Encodes image to base64
	 * 
	 * @param {IEmmetEditor} editor
	 * @param {String} imgPath Path to image
	 * @param {Number} pos Caret position where image is located in the editor
	 * @return {Boolean}
	 */
	function encodeToBase64(editor, imgPath, pos) {
		var file = require('file');
		var actionUtils = require('actionUtils');
		
		var editorFile = editor.getFilePath();
		var defaultMimeType = 'application/octet-stream';
			
		if (editorFile === null) {
			throw "You should save your file before using this action";
		}
		
		// locate real image path
		var realImgPath = file.locateFile(editorFile, imgPath);
		if (realImgPath === null) {
			throw "Can't find " + imgPath + ' file';
		}
		
		var b64 = require('base64').encode(String(file.read(realImgPath)));
		if (!b64) {
			throw "Can't encode file content to base64";
		}
		
		b64 = 'data:' + (actionUtils.mimeTypes[String(file.getExt(realImgPath))] || defaultMimeType) +
			';base64,' + b64;
			
		editor.replaceContent('$0' + b64, pos, pos + imgPath.length);
		return true;
	}

	/**
	 * Decodes base64 string back to file.
	 * @param {IEmmetEditor} editor
	 * @param {String} data Base64-encoded file content
	 * @param {Number} pos Caret position where image is located in the editor
	 */
	function decodeFromBase64(editor, data, pos) {
		// ask user to enter path to file
		var filePath = String(editor.prompt('Enter path to file (absolute or relative)'));
		if (!filePath)
			return false;
			
		var file = require('file');
		var absPath = file.createPath(editor.getFilePath(), filePath);
		if (!absPath) {
			throw "Can't save file";
		}
		
		file.save(absPath, require('base64').decode( data.replace(/^data\:.+?;.+?,/, '') ));
		editor.replaceContent('$0' + filePath, pos, pos + data.length);
		return true;
	}
});
/**
 * Automatically updates image size attributes in HTML's &lt;img&gt; element or
 * CSS rule
 * @param {Function} require
 * @param {Underscore} _
 * @constructor
 * @memberOf __updateImageSizeAction
 */
emmet.exec(function(require, _) {
	/**
	 * Updates image size of &lt;img src=""&gt; tag
	 * @param {IEmmetEditor} editor
	 */
	function updateImageSizeHTML(editor) {
		var offset = editor.getCaretPos();
		
		// find tag from current caret position
		var info = require('editorUtils').outputInfo(editor);
		var xmlElem = require('xmlEditTree').parseFromPosition(info.content, offset, true);
		if (xmlElem && (xmlElem.name() || '').toLowerCase() == 'img') {
			
			var size = getImageSizeForSource(editor, xmlElem.value('src'));
			if (size) {
				var compoundData = xmlElem.range(true);
				xmlElem.value('width', size.width);
				xmlElem.value('height', size.height, xmlElem.indexOf('width') + 1);
				
				return _.extend(compoundData, {
					data: xmlElem.toString(),
					caret: offset
				});
			}
		}
		
		return null;
	}
	
	/**
	 * Updates image size of CSS property
	 * @param {IEmmetEditor} editor
	 */
	function updateImageSizeCSS(editor) {
		var offset = editor.getCaretPos();
		
		// find tag from current caret position
		var info = require('editorUtils').outputInfo(editor);
		var cssRule = require('cssEditTree').parseFromPosition(info.content, offset, true);
		if (cssRule) {
			// check if there is property with image under caret
			var prop = cssRule.itemFromPosition(offset, true), m;
			if (prop && (m = /url\((["']?)(.+?)\1\)/i.exec(prop.value() || ''))) {
				var size = getImageSizeForSource(editor, m[2]);
				if (size) {
					var compoundData = cssRule.range(true);
					cssRule.value('width', size.width + 'px');
					cssRule.value('height', size.height + 'px', cssRule.indexOf('width') + 1);
					
					return _.extend(compoundData, {
						data: cssRule.toString(),
						caret: offset
					});
				}
			}
		}
		
		return null;
	}
	
	/**
	 * Returns image dimensions for source
	 * @param {IEmmetEditor} editor
	 * @param {String} src Image source (path or data:url)
	 */
	function getImageSizeForSource(editor, src) {
		var fileContent;
		if (src) {
			// check if it is data:url
			if (/^data:/.test(src)) {
				fileContent = require('base64').decode( src.replace(/^data\:.+?;.+?,/, '') );
			} else {
				var file = require('file');
				var absPath = file.locateFile(editor.getFilePath(), src);
				if (absPath === null) {
					throw "Can't find " + src + ' file';
				}
				
				fileContent = String(file.read(absPath));
			}
			
			return require('actionUtils').getImageSize(fileContent);
		}
	}
	
	require('actions').add('update_image_size', function(editor) {
		var result;
		if (String(editor.getSyntax()) == 'css') {
			result = updateImageSizeCSS(editor);
		} else {
			result = updateImageSizeHTML(editor);
		}
		
		return require('actionUtils').compoundUpdate(editor, result);
	});
});/**
 * Resolver for fast CSS typing. Handles abbreviations with the following 
 * notation:<br>
 * 
 * <code>(-vendor prefix)?property(value)*(!)?</code>
 * 
 * <br><br>
 * <b>Abbreviation handling</b><br>
 * 
 * By default, Emmet searches for matching snippet definition for provided abbreviation.
 * If snippet wasn't found, Emmet automatically generates element with 
 * abbreviation's name. For example, <code>foo</code> abbreviation will generate
 * <code>&lt;foo&gt;&lt;/foo&gt;</code> output.
 * <br><br>
 * This module will capture all expanded properties and upgrade them with values, 
 * vendor prefixes and !important declarations. All unmatched abbreviations will 
 * be automatically transformed into <code>property-name: ${1}</code> snippets. 
 * 
 * <b>Vendor prefixes<b><br>
 * 
 * If CSS-property is preceded with dash, resolver should output property with
 * all <i>known</i> vendor prefixes. For example, if <code>brad</code> 
 * abbreviation generates <code>border-radius: ${value};</code> snippet,
 * the <code>-brad</code> abbreviation should generate:
 * <pre><code>
 * -webkit-border-radius: ${value};
 * -moz-border-radius: ${value};
 * border-radius: ${value};
 * </code></pre>
 * Note that <i>o</i> and <i>ms</i> prefixes are omitted since Opera and IE 
 * supports unprefixed property.<br><br>
 * 
 * Users can also provide an explicit list of one-character prefixes for any
 * CSS property. For example, <code>-wm-float</code> will produce
 * 
 * <pre><code>
 * -webkit-float: ${1};
 * -moz-float: ${1};
 * float: ${1};
 * </code></pre>
 * 
 * Although this example looks pointless, users can use this feature to write
 * cutting-edge properties implemented by browser vendors recently.  
 * 
 * @constructor
 * @memberOf __cssResolverDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.define('cssResolver', function(require, _) {
	/** Back-reference to module */
	var module = null;
	
	var prefixObj = {
		/** Real vendor prefix name */
		prefix: 'emmet',
		
		/** 
		 * Indicates this prefix is obsolete and should't be used when user 
		 * wants to generate all-prefixed properties
		 */
		obsolete: false,
		
		/**
		 * Returns prefixed CSS property name
		 * @param {String} name Unprefixed CSS property
		 */
		transformName: function(name) {
			return '-' + this.prefix + '-' + name;
		},
		
		/**
		 * List of unprefixed CSS properties that supported by 
		 * current prefix. This list is used to generate all-prefixed property
		 * @returns {Array} 
		 */
		properties: function() {
			return getProperties('css.' + this.prefix + 'Properties') || [];
		},
		
		/**
		 * Check if given property is supported by current prefix
		 * @param name
		 */
		supports: function(name) {
			return _.include(this.properties(), name);
		}
	};
	
	
	/** 
	 * List of registered one-character prefixes. Key is a one-character prefix, 
	 * value is an <code>prefixObj</code> object
	 */
	var vendorPrefixes = {};
	
	var defaultValue = '${1};';
	
	// XXX module preferences
	var prefs = require('preferences');
	prefs.define('css.valueSeparator', ': ',
			'Defines a symbol that should be placed between CSS property and ' 
			+ 'value when expanding CSS abbreviations.');
	prefs.define('css.propertyEnd', ';',
			'Defines a symbol that should be placed at the end of CSS property  ' 
			+ 'when expanding CSS abbreviations.');
	
	prefs.define('stylus.valueSeparator', ' ',
			'Defines a symbol that should be placed between CSS property and ' 
			+ 'value when expanding CSS abbreviations in Stylus dialect.');
	prefs.define('stylus.propertyEnd', '',
			'Defines a symbol that should be placed at the end of CSS property  ' 
			+ 'when expanding CSS abbreviations in Stylus dialect.');
	
	prefs.define('sass.propertyEnd', '',
			'Defines a symbol that should be placed at the end of CSS property  ' 
			+ 'when expanding CSS abbreviations in SASS dialect.');
	
	prefs.define('css.autoInsertVendorPrefixes', true,
			'Automatically generate vendor-prefixed copies of expanded CSS ' 
			+ 'property. By default, Emmet will generate vendor-prefixed '
			+ 'properties only when you put dash before abbreviation ' 
			+ '(e.g. <code>-bxsh</code>). With this option enabled, you don’t ' 
			+ 'need dashes before abbreviations: Emmet will produce ' 
			+ 'vendor-prefixed properties for you.');
	
	var descTemplate = _.template('A comma-separated list of CSS properties that may have ' 
		+ '<code><%= vendor %></code> vendor prefix. This list is used to generate '
		+ 'a list of prefixed properties when expanding <code>-property</code> '
		+ 'abbreviations. Empty list means that all possible CSS values may ' 
		+ 'have <code><%= vendor %></code> prefix.');
	
	var descAddonTemplate = _.template('A comma-separated list of <em>additional</em> CSS properties ' 
			+ 'for <code>css.<%= vendor %>Preperties</code> preference. ' 
			+ 'You should use this list if you want to add or remove a few CSS ' 
			+ 'properties to original set. To add a new property, simply write its name, '
			+ 'to remove it, precede property with hyphen.<br>'
			+ 'For example, to add <em>foo</em> property and remove <em>border-radius</em> one, '
			+ 'the preference value will look like this: <code>foo, -border-radius</code>.');
	
	// properties list is created from cssFeatures.html file
	var props = {
		'webkit': 'animation, animation-delay, animation-direction, animation-duration, animation-fill-mode, animation-iteration-count, animation-name, animation-play-state, animation-timing-function, appearance, backface-visibility, background-clip, background-composite, background-origin, background-size, border-fit, border-horizontal-spacing, border-image, border-vertical-spacing, box-align, box-direction, box-flex, box-flex-group, box-lines, box-ordinal-group, box-orient, box-pack, box-reflect, box-shadow, color-correction, column-break-after, column-break-before, column-break-inside, column-count, column-gap, column-rule-color, column-rule-style, column-rule-width, column-span, column-width, dashboard-region, font-smoothing, highlight, hyphenate-character, hyphenate-limit-after, hyphenate-limit-before, hyphens, line-box-contain, line-break, line-clamp, locale, margin-before-collapse, margin-after-collapse, marquee-direction, marquee-increment, marquee-repetition, marquee-style, mask-attachment, mask-box-image, mask-box-image-outset, mask-box-image-repeat, mask-box-image-slice, mask-box-image-source, mask-box-image-width, mask-clip, mask-composite, mask-image, mask-origin, mask-position, mask-repeat, mask-size, nbsp-mode, perspective, perspective-origin, rtl-ordering, text-combine, text-decorations-in-effect, text-emphasis-color, text-emphasis-position, text-emphasis-style, text-fill-color, text-orientation, text-security, text-stroke-color, text-stroke-width, transform, transition, transform-origin, transform-style, transition-delay, transition-duration, transition-property, transition-timing-function, user-drag, user-modify, user-select, writing-mode, svg-shadow, box-sizing, border-radius',
		'moz': 'animation-delay, animation-direction, animation-duration, animation-fill-mode, animation-iteration-count, animation-name, animation-play-state, animation-timing-function, appearance, backface-visibility, background-inline-policy, binding, border-bottom-colors, border-image, border-left-colors, border-right-colors, border-top-colors, box-align, box-direction, box-flex, box-ordinal-group, box-orient, box-pack, box-shadow, box-sizing, column-count, column-gap, column-rule-color, column-rule-style, column-rule-width, column-width, float-edge, font-feature-settings, font-language-override, force-broken-image-icon, hyphens, image-region, orient, outline-radius-bottomleft, outline-radius-bottomright, outline-radius-topleft, outline-radius-topright, perspective, perspective-origin, stack-sizing, tab-size, text-blink, text-decoration-color, text-decoration-line, text-decoration-style, text-size-adjust, transform, transform-origin, transform-style, transition, transition-delay, transition-duration, transition-property, transition-timing-function, user-focus, user-input, user-modify, user-select, window-shadow, background-clip, border-radius',
		'ms': 'accelerator, backface-visibility, background-position-x, background-position-y, behavior, block-progression, box-align, box-direction, box-flex, box-line-progression, box-lines, box-ordinal-group, box-orient, box-pack, content-zoom-boundary, content-zoom-boundary-max, content-zoom-boundary-min, content-zoom-chaining, content-zoom-snap, content-zoom-snap-points, content-zoom-snap-type, content-zooming, filter, flow-from, flow-into, font-feature-settings, grid-column, grid-column-align, grid-column-span, grid-columns, grid-layer, grid-row, grid-row-align, grid-row-span, grid-rows, high-contrast-adjust, hyphenate-limit-chars, hyphenate-limit-lines, hyphenate-limit-zone, hyphens, ime-mode, interpolation-mode, layout-flow, layout-grid, layout-grid-char, layout-grid-line, layout-grid-mode, layout-grid-type, line-break, overflow-style, perspective, perspective-origin, perspective-origin-x, perspective-origin-y, scroll-boundary, scroll-boundary-bottom, scroll-boundary-left, scroll-boundary-right, scroll-boundary-top, scroll-chaining, scroll-rails, scroll-snap-points-x, scroll-snap-points-y, scroll-snap-type, scroll-snap-x, scroll-snap-y, scrollbar-arrow-color, scrollbar-base-color, scrollbar-darkshadow-color, scrollbar-face-color, scrollbar-highlight-color, scrollbar-shadow-color, scrollbar-track-color, text-align-last, text-autospace, text-justify, text-kashida-space, text-overflow, text-size-adjust, text-underline-position, touch-action, transform, transform-origin, transform-origin-x, transform-origin-y, transform-origin-z, transform-style, transition, transition-delay, transition-duration, transition-property, transition-timing-function, user-select, word-break, word-wrap, wrap-flow, wrap-margin, wrap-through, writing-mode',
		'o': 'dashboard-region, animation, animation-delay, animation-direction, animation-duration, animation-fill-mode, animation-iteration-count, animation-name, animation-play-state, animation-timing-function, border-image, link, link-source, object-fit, object-position, tab-size, table-baseline, transform, transform-origin, transition, transition-delay, transition-duration, transition-property, transition-timing-function, accesskey, input-format, input-required, marquee-dir, marquee-loop, marquee-speed, marquee-style'
	};
	
	_.each(props, function(v, k) {
		prefs.define('css.' + k + 'Properties', v, descTemplate({vendor: k}));
		prefs.define('css.' + k + 'PropertiesAddon', '', descAddonTemplate({vendor: k}));
	});
	
	prefs.define('css.unitlessProperties', 'z-index, line-height, opacity, font-weight, zoom', 
			'The list of properties whose values ​​must not contain units.');
	
	prefs.define('css.intUnit', 'px', 'Default unit for integer values');
	prefs.define('css.floatUnit', 'em', 'Default unit for float values');
	
	prefs.define('css.keywords', 'auto, inherit', 
			'A comma-separated list of valid keywords that can be used in CSS abbreviations.');
	
	prefs.define('css.keywordAliases', 'a:auto, i:inherit, s:solid, da:dashed, do:dotted', 
			'A comma-separated list of keyword aliases, used in CSS abbreviation. '
			+ 'Each alias should be defined as <code>alias:keyword_name</code>.');
	
	prefs.define('css.unitAliases', 'e:em, p:%, x:ex, r:rem', 
			'A comma-separated list of unit aliases, used in CSS abbreviation. '
			+ 'Each alias should be defined as <code>alias:unit_value</code>.');
	
	prefs.define('css.color.short', true, 
			'Should color values like <code>#ffffff</code> be shortened to '
			+ '<code>#fff</code> after abbreviation with color was expanded.');
	
	prefs.define('css.color.case', 'keep', 
			'Letter case of color values generated by abbreviations with color '
			+ '(like <code>c#0</code>). Possible values are <code>upper</code>, '
			+ '<code>lower</code> and <code>keep</code>.');
	
	prefs.define('css.fuzzySearch', true, 
			'Enable fuzzy search among CSS snippet names. When enabled, every ' 
			+ '<em>unknown</em> snippet will be scored against available snippet '
			+ 'names (not values or CSS properties!). The match with best score '
			+ 'will be used to resolve snippet value. For example, with this ' 
			+ 'preference enabled, the following abbreviations are equal: '
			+ '<code>ov:h</code> == <code>ov-h</code> == <code>o-h</code> == '
			+ '<code>oh</code>');
	
	prefs.define('css.fuzzySearchMinScore', 0.3, 
			'The minium score (from 0 to 1) that fuzzy-matched abbreviation should ' 
			+ 'achive. Lower values may produce many false-positive matches, '
			+ 'higher values may reduce possible matches.');
	
	
	function isNumeric(ch) {
		var code = ch && ch.charCodeAt(0);
		return (ch && ch == '.' || (code > 47 && code < 58));
	}
	
	/**
	 * Check if provided snippet contains only one CSS property and value.
	 * @param {String} snippet
	 * @returns {Boolean}
	 */
	function isSingleProperty(snippet) {
		var utils = require('utils');
		snippet = utils.trim(snippet);
		
		// check if it doesn't contain a comment and a newline
		if (~snippet.indexOf('/*') || /[\n\r]/.test(snippet)) {
			return false;
		}
		
		// check if it's a valid snippet definition
		if (!/^[a-z0-9\-]+\s*\:/i.test(snippet)) {
			return false;
		}
		
		snippet = require('tabStops').processText(snippet, {
			replaceCarets: true,
			tabstop: function() {
				return 'value';
			}
		});
		
		return snippet.split(':').length == 2;
	}
	
	/**
	 * Normalizes abbreviated value to final CSS one
	 * @param {String} value
	 * @returns {String}
	 */
	function normalizeValue(value) {
		if (value.charAt(0) == '-' && !/^\-[\.\d]/) {
			value = value.replace(/^\-+/, '');
		}
		
		if (value.charAt(0) == '#') {
			return normalizeHexColor(value);
		}
		
		return getKeyword(value);
	}
	
	function normalizeHexColor(value) {
		var hex = value.replace(/^#+/, '');
		var repeat = require('utils').repeatString;
		var color = null;
		switch (hex.length) {
			case 1:
				color = repeat(hex, 6);
				break;
			case 2:
				color = repeat(hex, 3);
				break;
			case 3:
				color = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
				break;
			case 4:
				color = hex + hex.substr(0, 2);
				break;
			case 5:
				color = hex + hex.charAt(0);
				break;
			default:
				color = hex.substr(0, 6);
		}
		
		// color must be shortened?
		if (prefs.get('css.color.short')) {
			var p = color.split('');
			if (p[0] == p[1] && p[2] == p[3] && p[4] == p[5]) {
				color = p[0] + p[2] + p[4];
			}
		}
		
		// should transform case?
		switch (prefs.get('css.color.case')) {
			case 'upper':
				color = color.toUpperCase();
				break;
			case 'lower':
				color = color.toLowerCase();
				break;
		}
		
		return '#' + color;
	}
	
	function getKeyword(name) {
		var aliases = prefs.getDict('css.keywordAliases');
		return name in aliases ? aliases[name] : name;
	}
	
	function getUnit(name) {
		var aliases = prefs.getDict('css.unitAliases');
		return name in aliases ? aliases[name] : name;
	}
	
	function isValidKeyword(keyword) {
		return _.include(prefs.getArray('css.keywords'), getKeyword(keyword));
	}
	
	/**
	 * Split snippet into a CSS property-value pair
	 * @param {String} snippet
	 */
	function splitSnippet(snippet) {
		var utils = require('utils');
		snippet = utils.trim(snippet);
		if (snippet.indexOf(':') == -1) {
			return {
				name: snippet,
				value: defaultValue
			};
		}
		
		var pair = snippet.split(':');
		
		return {
			name: utils.trim(pair.shift()),
			// replace ${0} tabstop to produce valid vendor-prefixed values
			// where possible
			value: utils.trim(pair.join(':')).replace(/^(\$\{0\}|\$0)(\s*;?)$/, '${1}$2')
		};
	}
	
	/**
	 * Check if passed CSS property support specified vendor prefix 
	 * @param {String} property
	 * @param {String} prefix
	 */
	function hasPrefix(property, prefix) {
		var info = vendorPrefixes[prefix];
		
		if (!info)
			info = _.find(vendorPrefixes, function(data) {
				return data.prefix == prefix;
			});
		
		return info && info.supports(property);
	}
	
	/**
	 * Search for a list of supported prefixes for CSS property. This list
	 * is used to generate all-prefixed snippet
	 * @param {String} property CSS property name
	 * @returns {Array}
	 */
	function findPrefixes(property, noAutofill) {
		var result = [];
		_.each(vendorPrefixes, function(obj, prefix) {
			if (hasPrefix(property, prefix)) {
				result.push(prefix);
			}
		});
		
		if (!result.length && !noAutofill) {
			// add all non-obsolete prefixes
			_.each(vendorPrefixes, function(obj, prefix) {
				if (!obj.obsolete)
					result.push(prefix);
			});
		}
		
		return result;
	}
	
	function addPrefix(name, obj) {
		if (_.isString(obj))
			obj = {prefix: obj};
		
		vendorPrefixes[name] = _.extend({}, prefixObj, obj);
	}
	
	function getSyntaxPreference(name, syntax) {
		if (syntax) {
			var val = prefs.get(syntax + '.' + name);
			if (!_.isUndefined(val))
				return val;
		}
		
		return prefs.get('css.' + name);
	}
	
	/**
	 * Format CSS property according to current syntax dialect
	 * @param {String} property
	 * @param {String} syntax
	 * @returns {String}
	 */
	function formatProperty(property, syntax) {
		var ix = property.indexOf(':');
		property = property.substring(0, ix).replace(/\s+$/, '') 
			+ getSyntaxPreference('valueSeparator', syntax)
			+ require('utils').trim(property.substring(ix + 1));
		
		return property.replace(/\s*;\s*$/, getSyntaxPreference('propertyEnd', syntax));
	}
	
	/**
	 * Transforms snippet value if required. For example, this transformation
	 * may add <i>!important</i> declaration to CSS property
	 * @param {String} snippet
	 * @param {Boolean} isImportant
	 * @returns {String}
	 */
	function transformSnippet(snippet, isImportant, syntax) {
		if (!_.isString(snippet))
			snippet = snippet.data;
		
		if (!isSingleProperty(snippet))
			return snippet;
		
		if (isImportant) {
			if (~snippet.indexOf(';')) {
				snippet = snippet.split(';').join(' !important;');
			} else {
				snippet += ' !important';
			}
		}
		
		return formatProperty(snippet, syntax);
	}
	
	/**
	 * Helper function that parses comma-separated list of elements into array
	 * @param {String} list
	 * @returns {Array}
	 */
	function parseList(list) {
		var result = _.map((list || '').split(','), require('utils').trim);
		return result.length ? result : null;
	}
	
	function getProperties(key) {
		var list = prefs.getArray(key);
		_.each(prefs.getArray(key + 'Addon'), function(prop) {
			if (prop.charAt(0) == '-') {
				list = _.without(list, prop.substr(1));
			} else {
				if (prop.charAt(0) == '+')
					prop = prop.substr(1);
				
				list.push(prop);
			}
		});
		
		return list;
	}
	
	
	// TODO refactor, this looks awkward now
	addPrefix('w', {
		prefix: 'webkit'
	});
	addPrefix('m', {
		prefix: 'moz'
	});
	addPrefix('s', {
		prefix: 'ms'
	});
	addPrefix('o', {
		prefix: 'o'
	});
	
	// I think nobody uses it
//	addPrefix('k', {
//		prefix: 'khtml',
//		obsolete: true
//	});
	
	var cssSyntaxes = ['css', 'less', 'sass', 'scss', 'stylus'];
	
	/**
	 * XXX register resolver
	 * @param {TreeNode} node
	 * @param {String} syntax
	 */
	require('resources').addResolver(function(node, syntax) {
		if (_.include(cssSyntaxes, syntax) && node.isElement()) {
			return module.expandToSnippet(node.abbreviation, syntax);
		}
		
		return null;
	});
	
	var ea = require('expandAbbreviation');
	/**
	 * For CSS-like syntaxes, we need to handle a special use case. Some editors
	 * (like Sublime Text 2) may insert semicolons automatically when user types
	 * abbreviation. After expansion, user receives a double semicolon. This
	 * handler automatically removes semicolon from generated content in such cases.
	 * @param {IEmmetEditor} editor
	 * @param {String} syntax
	 * @param {String} profile
	 */
	ea.addHandler(function(editor, syntax, profile) {
		if (!_.include(cssSyntaxes, syntax)) {
			return false;
		}
		
		var caretPos = editor.getSelectionRange().end;
		var abbr = ea.findAbbreviation(editor);
			
		if (abbr) {
			var content = emmet.expandAbbreviation(abbr, syntax, profile);
			if (content) {
				var replaceFrom = caretPos - abbr.length;
				var replaceTo = caretPos;
				if (editor.getContent().charAt(caretPos) == ';' && content.charAt(content.length - 1) == ';') {
					replaceTo++;
				}
				
				editor.replaceContent(content, replaceFrom, replaceTo);
				return true;
			}
		}
		
		return false;
	});
	
	return module = {
		/**
		 * Adds vendor prefix
		 * @param {String} name One-character prefix name
		 * @param {Object} obj Object describing vendor prefix
		 * @memberOf cssResolver
		 */
		addPrefix: addPrefix,
		
		/**
		 * Check if passed CSS property supports specified vendor prefix
		 * @param {String} property
		 * @param {String} prefix
		 */
		supportsPrefix: hasPrefix,
		
		/**
		 * Returns prefixed version of passed CSS property, only if this
		 * property supports such prefix
		 * @param {String} property
		 * @param {String} prefix
		 * @returns
		 */
		prefixed: function(property, prefix) {
			return hasPrefix(property, prefix) 
				? '-' + prefix + '-' + property 
				: property;
		},
		
		/**
		 * Returns list of all registered vendor prefixes
		 * @returns {Array}
		 */
		listPrefixes: function() {
			return _.map(vendorPrefixes, function(obj) {
				return obj.prefix;
			});
		},
		
		/**
		 * Returns object describing vendor prefix
		 * @param {String} name
		 * @returns {Object}
		 */
		getPrefix: function(name) {
			return vendorPrefixes[name];
		},
		
		/**
		 * Removes prefix object
		 * @param {String} name
		 */
		removePrefix: function(name) {
			if (name in vendorPrefixes)
				delete vendorPrefixes[name];
		},
		
		/**
		 * Extract vendor prefixes from abbreviation
		 * @param {String} abbr
		 * @returns {Object} Object containing array of prefixes and clean 
		 * abbreviation name
		 */
		extractPrefixes: function(abbr) {
			if (abbr.charAt(0) != '-') {
				return {
					property: abbr,
					prefixes: null
				};
			}
			
			// abbreviation may either contain sequence of one-character prefixes
			// or just dash, meaning that user wants to produce all possible
			// prefixed properties
			var i = 1, il = abbr.length, ch;
			var prefixes = [];
			
			while (i < il) {
				ch = abbr.charAt(i);
				if (ch == '-') {
					// end-sequence character found, stop searching
					i++;
					break;
				}
				
				if (ch in vendorPrefixes) {
					prefixes.push(ch);
				} else {
					// no prefix found, meaning user want to produce all
					// vendor-prefixed properties
					prefixes.length = 0;
					i = 1;
					break;
				}
				
				i++;
			}
			
			// reached end of abbreviation and no property name left
			if (i == il -1) {
				i = 1;
				prefixes.length = 1;
			}
			
			return {
				property: abbr.substring(i),
				prefixes: prefixes.length ? prefixes : 'all'
			};
		},
		
		/**
		 * Search for value substring in abbreviation
		 * @param {String} abbr
		 * @returns {String} Value substring
		 */
		findValuesInAbbreviation: function(abbr, syntax) {
			syntax = syntax || 'css';
			
			var i = 0, il = abbr.length, value = '', ch;
			while (i < il) {
				ch = abbr.charAt(i);
				if (isNumeric(ch) || ch == '#' || (ch == '-' && isNumeric(abbr.charAt(i + 1)))) {
					value = abbr.substring(i);
					break;
				}
				
				i++;
			}
			
			// try to find keywords in abbreviation
			var property = abbr.substring(0, abbr.length - value.length);
			var res = require('resources');
			var keywords = [];
			// try to extract some commonly-used properties
			while (~property.indexOf('-') && !res.findSnippet(syntax, property)) {
				var parts = property.split('-');
				var lastPart = parts.pop();
				if (!isValidKeyword(lastPart)) {
					break;
				}
				
				keywords.unshift(lastPart);
				property = parts.join('-');
			}
			
			return keywords.join('-') + value;
		},
		
		parseValues: function(str) {
			/** @type StringStream */
			var stream = require('stringStream').create(str);
			var values = [];
			var ch = null;
			
			while (ch = stream.next()) {
				if (ch == '#') {
					stream.match(/^[0-9a-f]+/, true);
					values.push(stream.current());
				} else if (ch == '-') {
					if (isValidKeyword(_.last(values)) || 
							( stream.start && isNumeric(str.charAt(stream.start - 1)) )
						) {
						stream.start = stream.pos;
					}
					
					stream.match(/^\-?[0-9]*(\.[0-9]+)?[a-z\.]*/, true);
					values.push(stream.current());
				} else {
					stream.match(/^[0-9]*(\.[0-9]+)?[a-z]*/, true);
					values.push(stream.current());
				}
				
				stream.start = stream.pos;
			}
			
			return _.map(_.compact(values), normalizeValue);
		},
		
		/**
		 * Extracts values from abbreviation
		 * @param {String} abbr
		 * @returns {Object} Object containing array of values and clean 
		 * abbreviation name
		 */
		extractValues: function(abbr) {
			// search for value start
			var abbrValues = this.findValuesInAbbreviation(abbr);
			if (!abbrValues) {
				return {
					property: abbr,
					values: null
				};
			}
			
			return {
				property: abbr.substring(0, abbr.length - abbrValues.length).replace(/-$/, ''),
				values: this.parseValues(abbrValues)
			};
		},
		
		/**
		 * Normalizes value, defined in abbreviation.
		 * @param {String} value
		 * @param {String} property
		 * @returns {String}
		 */
		normalizeValue: function(value, property) {
			property = (property || '').toLowerCase();
			var unitlessProps = prefs.getArray('css.unitlessProperties');
			return value.replace(/^(\-?[0-9\.]+)([a-z]*)$/, function(str, val, unit) {
				if (!unit && (val == '0' || _.include(unitlessProps, property)))
					return val;
				
				if (!unit)
					return val + prefs.get(~val.indexOf('.') ? 'css.floatUnit' : 'css.intUnit');
				
				return val + getUnit(unit);
			});
		},
		
		/**
		 * Expands abbreviation into a snippet
		 * @param {String} abbr Abbreviation name to expand
		 * @param {String} value Abbreviation value
		 * @param {String} syntax Currect syntax or dialect. Default is 'css'
		 * @returns {Object} Array of CSS properties and values or predefined
		 * snippet (string or element)
		 */
		expand: function(abbr, value, syntax) {
			syntax = syntax || 'css';
			var resources = require('resources');
			var autoInsertPrefixes = prefs.get('css.autoInsertVendorPrefixes');
			
			// check if snippet should be transformed to !important
			var isImportant;
			if (isImportant = /^(.+)\!$/.test(abbr)) {
				abbr = RegExp.$1;
			}
			
			// check if we have abbreviated resource
			var snippet = resources.findSnippet(syntax, abbr);
			if (snippet && !autoInsertPrefixes) {
				return transformSnippet(snippet, isImportant, syntax);
			}
			
			// no abbreviated resource, parse abbreviation
			var prefixData = this.extractPrefixes(abbr);
			var valuesData = this.extractValues(prefixData.property);
			var abbrData = _.extend(prefixData, valuesData);
			
			snippet = resources.findSnippet(syntax, abbrData.property);
			
			// fallback to some old snippets like m:a
//			if (!snippet && ~abbrData.property.indexOf(':')) {
//				var parts = abbrData.property.split(':');
//				var propertyName = parts.shift();
//				snippet = resources.findSnippet(syntax, propertyName) || propertyName;
//				abbrData.values = this.parseValues(parts.join(':'));
//			}
			
			if (!snippet && prefs.get('css.fuzzySearch')) {
				// let’s try fuzzy search
				snippet = resources.fuzzyFindSnippet(syntax, abbrData.property, parseFloat(prefs.get('css.fuzzySearchMinScore')));
			}
			
			if (!snippet) {
				snippet = abbrData.property + ':' + defaultValue;
			} else if (!_.isString(snippet)) {
				snippet = snippet.data;
			}
			
			if (!isSingleProperty(snippet)) {
				return snippet;
			}
			
			var snippetObj = splitSnippet(snippet);
			var result = [];
			if (!value && abbrData.values) {
				value = _.map(abbrData.values, function(val) {
					return this.normalizeValue(val, snippetObj.name);
				}, this).join(' ') + ';';
			}
			
			snippetObj.value = value || snippetObj.value;
			
			var prefixes = abbrData.prefixes == 'all' || (!abbrData.prefixes && autoInsertPrefixes) 
				? findPrefixes(snippetObj.name, autoInsertPrefixes && abbrData.prefixes != 'all')
				: abbrData.prefixes;
				
			_.each(prefixes, function(p) {
				if (p in vendorPrefixes) {
					result.push(transformSnippet(
							vendorPrefixes[p].transformName(snippetObj.name) 
							+ ':' + snippetObj.value,
							isImportant, syntax));
					
				}
			});
			
			// put the original property
			result.push(transformSnippet(snippetObj.name + ':' + snippetObj.value, isImportant, syntax));
			
			return result;
		},
		
		/**
		 * Same as <code>expand</code> method but transforms output into 
		 * Emmet snippet
		 * @param {String} abbr
		 * @param {String} syntax
		 * @returns {String}
		 */
		expandToSnippet: function(abbr, syntax) {
			var snippet = this.expand(abbr, null, syntax);
			if (_.isArray(snippet)) {
				return snippet.join('\n');
			}
			
			if (!_.isString(snippet))
				return snippet.data;
			
			return String(snippet);
		},
		
		getSyntaxPreference: getSyntaxPreference,
		transformSnippet: transformSnippet
	};
});
/**
 * 'Expand Abbreviation' handler that parses gradient definition from under 
 * cursor and updates CSS rule with vendor-prefixed values.
 * 
 * @memberOf __cssGradientHandlerDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.define('cssGradient', function(require, _) {
	var defaultLinearDirections = ['top', 'to bottom', '0deg'];
	/** Back-reference to current module */
	var module = null;
	
	var cssSyntaxes = ['css', 'less', 'sass', 'scss', 'stylus', 'styl'];
	
	var reDeg = /\d+deg/i;
	var reKeyword = /top|bottom|left|right/i;
	
	// XXX define preferences
	/** @type preferences */
	var prefs = require('preferences');
	prefs.define('css.gradient.prefixes', 'webkit, moz, o',
			'A comma-separated list of vendor-prefixes for which values should ' 
			+ 'be generated.');
	
	prefs.define('css.gradient.oldWebkit', true,
			'Generate gradient definition for old Webkit implementations');
	
	prefs.define('css.gradient.omitDefaultDirection', true,
		'Do not output default direction definition in generated gradients.');
	
	prefs.define('css.gradient.defaultProperty', 'background-image',
		'When gradient expanded outside CSS value context, it will produce '
			+ 'properties with this name.');
	
	prefs.define('css.gradient.fallback', false,
			'With this option enabled, CSS gradient generator will produce '
			+ '<code>background-color</code> property with gradient first color '
			+ 'as fallback for old browsers.');
	
	function normalizeSpace(str) {
		return require('utils').trim(str).replace(/\s+/g, ' ');
	}
	
	/**
	 * Parses linear gradient definition
	 * @param {String}
	 */
	function parseLinearGradient(gradient) {
		var direction = defaultLinearDirections[0];
		
		// extract tokens
		/** @type StringStream */
		var stream = require('stringStream').create(require('utils').trim(gradient));
		var colorStops = [], ch;
		while (ch = stream.next()) {
			if (stream.peek() == ',') {
				colorStops.push(stream.current());
				stream.next();
				stream.eatSpace();
				stream.start = stream.pos;
			} else if (ch == '(') { // color definition, like 'rgb(0,0,0)'
				stream.skipTo(')');
			}
		}
		
		// add last token
		colorStops.push(stream.current());
		colorStops = _.compact(_.map(colorStops, normalizeSpace));
		
		if (!colorStops.length)
			return null;
		
		// let's see if the first color stop is actually a direction
		if (reDeg.test(colorStops[0]) || reKeyword.test(colorStops[0])) {
			direction = colorStops.shift();
		}
		
		return {
			type: 'linear',
			direction: direction,
			colorStops: _.map(colorStops, parseColorStop)
		};
	}
	
	/**
	 * Parses color stop definition
	 * @param {String} colorStop
	 * @returns {Object}
	 */
	function parseColorStop(colorStop) {
		colorStop = normalizeSpace(colorStop);
		
		// find color declaration
		// first, try complex color declaration, like rgb(0,0,0)
		var color = null;
		colorStop = colorStop.replace(/^(\w+\(.+?\))\s*/, function(str, c) {
			color = c;
			return '';
		});
		
		if (!color) {
			// try simple declaration, like yellow, #fco, #ffffff, etc.
			var parts = colorStop.split(' ');
			color = parts[0];
			colorStop = parts[1] || '';
		}
		
		var result = {
			color: color
		};
		
		if (colorStop) {
			// there's position in color stop definition
			colorStop.replace(/^(\-?[\d\.]+)([a-z%]+)?$/, function(str, pos, unit) {
				result.position = pos;
				if (~pos.indexOf('.')) {
					unit = '';
				} else if (!unit) {
					unit = '%';
				}
				
				if (unit)
					result.unit = unit;
			});
		}
		
		return result;
	}
	
	/**
	 * Fills-out implied positions in color-stops. This function is useful for
	 * old Webkit gradient definitions
	 */
	function fillImpliedPositions(colorStops) {
		var from = 0;
		
		_.each(colorStops, function(cs, i) {
			// make sure that first and last positions are defined
			if (!i)
				return cs.position = cs.position || 0;
			
			if (i == colorStops.length - 1 && !('position' in cs))
				cs.position = 1;
			
			if ('position' in cs) {
				var start = colorStops[from].position || 0;
				var step = (cs.position - start) / (i - from);
				_.each(colorStops.slice(from, i), function(cs2, j) {
					cs2.position = start + step * j;
				});
				
				from = i;
			}
		});
	}
	
	/**
	 * Returns textual version of direction expressed in degrees
	 * @param {String} direction
	 * @returns {String}
	 */
	function textualDirection(direction) {
		var angle = parseFloat(direction);
		
		if(!_.isNaN(angle)) {
			switch(angle % 360) {
				case 0:   return 'left';
				case 90:  return 'bottom';
				case 180: return 'right';
				case 240: return 'top';
			}
		}
		
		return direction;
	}
	
	/**
	 * Creates direction definition for old Webkit gradients
	 * @param {String} direction
	 * @returns {String}
	 */
	function oldWebkitDirection(direction) {
		direction = textualDirection(direction);
		
		if(reDeg.test(direction))
			throw "The direction is an angle that can’t be converted.";
		
		var v = function(pos) {
			return ~direction.indexOf(pos) ? '100%' : '0';
		};
		
		return v('right') + ' ' + v('bottom') + ', ' + v('left') + ' ' + v('top');
	}
	
	function getPrefixedNames(name) {
		var prefixes = prefs.getArray('css.gradient.prefixes');
		var names = _.map(prefixes, function(p) {
			return '-' + p + '-' + name;
		});
		names.push(name);
		
		return names;
	}
	
	/**
	 * Returns list of CSS properties with gradient
	 * @param {Object} gradient
	 * @param {String} propertyName Original CSS property name
	 * @returns {Array}
	 */
	function getPropertiesForGradient(gradient, propertyName) {
		var props = [];
		var css = require('cssResolver');
		
		if (prefs.get('css.gradient.fallback') && ~propertyName.toLowerCase().indexOf('background')) {
			props.push({
				name: 'background-color',
				value: '${1:' + gradient.colorStops[0].color + '}'
			});
		}
		
		_.each(prefs.getArray('css.gradient.prefixes'), function(prefix) {
			var name = css.prefixed(propertyName, prefix);
			if (prefix == 'webkit' && prefs.get('css.gradient.oldWebkit')) {
				try {
					props.push({
						name: name,
						value: module.oldWebkitLinearGradient(gradient)
					});
				} catch(e) {}
			}
			
			props.push({
				name: name,
				value: module.toString(gradient, prefix)
			});
		});
		
		return props.sort(function(a, b) {
			return b.name.length - a.name.length;
		});
	}
	
	/**
	 * Pastes gradient definition into CSS rule with correct vendor-prefixes
	 * @param {EditElement} property Matched CSS property
	 * @param {Object} gradient Parsed gradient
	 * @param {Range} valueRange If passed, only this range within property 
	 * value will be replaced with gradient. Otherwise, full value will be 
	 * replaced
	 */
	function pasteGradient(property, gradient, valueRange) {
		var rule = property.parent;
		var utils = require('utils');
		
		// first, remove all properties within CSS rule with the same name and
		// gradient definition
		_.each(rule.getAll(getPrefixedNames(property.name())), function(item) {
			if (item != property && /gradient/i.test(item.value())) {
				rule.remove(item);
			}
		});
		
		var value = property.value();
		if (!valueRange)
			valueRange = require('range').create(0, property.value());
		
		var val = function(v) {
			return utils.replaceSubstring(value, v, valueRange);
		};
		
		// put vanilla-clean gradient definition into current rule
		property.value(val(module.toString(gradient)) + '${2}');
		
		// create list of properties to insert
		var propsToInsert = getPropertiesForGradient(gradient, property.name());
		
		// put vendor-prefixed definitions before current rule
		_.each(propsToInsert, function(prop) {
			rule.add(prop.name, prop.value, rule.indexOf(property));
		});
	}
	
	/**
	 * Search for gradient definition inside CSS property value
	 */
	function findGradient(cssProp) {
		var value = cssProp.value();
		var gradient = null;
		var matchedPart = _.find(cssProp.valueParts(), function(part) {
			return gradient = module.parse(part.substring(value));
		});
		
		if (matchedPart && gradient) {
			return {
				gradient: gradient,
				valueRange: matchedPart
			};
		}
		
		return null;
	}
	
	/**
	 * Tries to expand gradient outside CSS value 
	 * @param {IEmmetEditor} editor
	 * @param {String} syntax
	 */
	function expandGradientOutsideValue(editor, syntax) {
		var propertyName = prefs.get('css.gradient.defaultProperty');
		
		if (!propertyName)
			return false;
		
		// assuming that gradient definition is written on new line,
		// do a simplified parsing
		var content = String(editor.getContent());
		/** @type Range */
		var lineRange = require('range').create(editor.getCurrentLineRange());
		
		// get line content and adjust range with padding
		var line = lineRange.substring(content)
			.replace(/^\s+/, function(pad) {
				lineRange.start += pad.length;
				return '';
			})
			.replace(/\s+$/, function(pad) {
				lineRange.end -= pad.length;
				return '';
			});
		
		var css = require('cssResolver');
		var gradient = module.parse(line);
		if (gradient) {
			var props = getPropertiesForGradient(gradient, propertyName);
			props.push({
				name: propertyName,
				value: module.toString(gradient) + '${2}'
			});
			
			var sep = css.getSyntaxPreference('valueSeparator', syntax);
			var end = css.getSyntaxPreference('propertyEnd', syntax);
			props = _.map(props, function(item) {
				return item.name + sep + item.value + end;
			});
			
			editor.replaceContent(props.join('\n'), lineRange.start, lineRange.end);
			return true;
		}
		
		return false;
	}
	
	/**
	 * Search for gradient definition inside CSS value under cursor
	 * @param {String} content
	 * @param {Number} pos
	 * @returns {Object}
	 */
	function findGradientFromPosition(content, pos) {
		var cssProp = null;
		/** @type EditContainer */
		var cssRule = require('cssEditTree').parseFromPosition(content, pos, true);
		
		if (cssRule) {
			cssProp = cssRule.itemFromPosition(pos, true);
			if (!cssProp) {
				// in case user just started writing CSS property
				// and didn't include semicolon–try another approach
				cssProp = _.find(cssRule.list(), function(elem) {
					return elem.range(true).end == pos;
				});
			}
		}
		
		return {
			rule: cssRule,
			property: cssProp
		};
	}
	
	// XXX register expand abbreviation handler
	/**
	 * @param {IEmmetEditor} editor
	 * @param {String} syntax
	 * @param {String} profile
	 */
	require('expandAbbreviation').addHandler(function(editor, syntax, profile) {
		var info = require('editorUtils').outputInfo(editor, syntax, profile);
		if (!_.include(cssSyntaxes, info.syntax))
			return false;
		
		// let's see if we are expanding gradient definition
		var caret = editor.getCaretPos();
		var content = info.content;
		var css = findGradientFromPosition(content, caret);
		
		if (css.property) {
			// make sure that caret is inside property value with gradient 
			// definition
			var g = findGradient(css.property);
			if (g) {
				var ruleStart = css.rule.options.offset || 0;
				var ruleEnd = ruleStart + css.rule.toString().length;
				
				// Handle special case:
				// user wrote gradient definition between existing CSS 
				// properties and did not finished it with semicolon.
				// In this case, we have semicolon right after gradient 
				// definition and re-parse rule again
				if (/[\n\r]/.test(css.property.value())) {
					// insert semicolon at the end of gradient definition
					var insertPos = css.property.valueRange(true).start + g.valueRange.end;
					content = require('utils').replaceSubstring(content, ';', insertPos);
					var newCss = findGradientFromPosition(content, caret);
					if (newCss.property) {
						g = findGradient(newCss.property);
						css = newCss;
					}
				}
				
				// make sure current property has terminating semicolon
				css.property.end(';');
				
				pasteGradient(css.property, g.gradient, g.valueRange);
				editor.replaceContent(css.rule.toString(), ruleStart, ruleEnd, true);
				return true;
			}
		}
		
		return expandGradientOutsideValue(editor, syntax);
	});
	
	// XXX register "Reflect CSS Value" action delegate
	/**
	 * @param {EditElement} property
	 */
	require('reflectCSSValue').addHandler(function(property) {
		var utils = require('utils');
		
		var g = findGradient(property);
		if (!g)
			return false;
		
		var value = property.value();
		var val = function(v) {
			return utils.replaceSubstring(value, v, g.valueRange);
		};
		
		// reflect value for properties with the same name
		_.each(property.parent.getAll(getPrefixedNames(property.name())), function(prop) {
			if (prop === property)
				return;
			
			// check if property value starts with gradient definition
			var m = prop.value().match(/^\s*(\-([a-z]+)\-)?linear\-gradient/);
			if (m) {
				prop.value(val(module.toString(g.gradient, m[2] || '')));
			} else if (m = prop.value().match(/\s*\-webkit\-gradient/)) {
				// old webkit gradient definition
				prop.value(val(module.oldWebkitLinearGradient(g.gradient)));
			}
		});
		
		return true;
	});
	
	return module = {
		/**
		 * Parses gradient definition
		 * @param {String} gradient
		 * @returns {Object}
		 */
		parse: function(gradient) {
			var result = null;
			require('utils').trim(gradient).replace(/^([\w\-]+)\((.+?)\)$/, function(str, type, definition) {
				// remove vendor prefix
				type = type.toLowerCase().replace(/^\-[a-z]+\-/, '');
				if (type == 'linear-gradient' || type == 'lg') {
					result = parseLinearGradient(definition);
					return '';
				}
				
				return str;
			});
			
			return result;
		},
		
		/**
		 * Produces linear gradient definition used in early Webkit 
		 * implementations
		 * @param {Object} gradient Parsed gradient
		 * @returns {String}
		 */
		oldWebkitLinearGradient: function(gradient) {
			if (_.isString(gradient))
				gradient = this.parse(gradient);
			
			if (!gradient)
				return null;
			
			var colorStops = _.map(gradient.colorStops, _.clone);
			
			// normalize color-stops position
			_.each(colorStops, function(cs) {
				if (!('position' in cs)) // implied position
					return;
				
				if (~cs.position.indexOf('.') || cs.unit == '%') {
					cs.position = parseFloat(cs.position) / (cs.unit == '%' ? 100 : 1);
				} else {
					throw "Can't convert color stop '" + (cs.position + (cs.unit || '')) + "'";
				}
			});
			
			fillImpliedPositions(colorStops);
			
			// transform color-stops into string representation
			colorStops = _.map(colorStops, function(cs, i) {
				if (!cs.position && !i)
					return 'from(' + cs.color + ')';
				
				if (cs.position == 1 && i == colorStops.length - 1)
					return 'to(' + cs.color + ')';
				
				return 'color-stop(' + (cs.position.toFixed(2).replace(/\.?0+$/, '')) + ', ' + cs.color + ')';
			});
			
			return '-webkit-gradient(linear, ' 
				+ oldWebkitDirection(gradient.direction)
				+ ', '
				+ colorStops.join(', ')
				+ ')';
		},
		
		/**
		 * Returns string representation of parsed gradient
		 * @param {Object} gradient Parsed gradient
		 * @param {String} prefix Vendor prefix
		 * @returns {String}
		 */
		toString: function(gradient, prefix) {
			if (gradient.type == 'linear') {
				var fn = (prefix ? '-' + prefix + '-' : '') + 'linear-gradient';
				
				// transform color-stops
				var colorStops = _.map(gradient.colorStops, function(cs) {
					return cs.color + ('position' in cs 
							? ' ' + cs.position + (cs.unit || '')
							: '');
				});
				
				if (gradient.direction 
						&& (!prefs.get('css.gradient.omitDefaultDirection') 
						|| !_.include(defaultLinearDirections, gradient.direction))) {
					colorStops.unshift(gradient.direction);
				}
				
				return fn + '(' + colorStops.join(', ') + ')';
			}
		}
	};
});/**
 * Module adds support for generators: a regexp-based abbreviation resolver 
 * that can produce custom output.
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _) {
	/** @type HandlerList */
	var generators = require('handlerList').create();
	var resources = require('resources');
	
	_.extend(resources, {
		/**
		 * Add generator. A generator function <code>fn</code> will be called 
		 * only if current abbreviation matches <code>regexp</code> regular 
		 * expression and this function should return <code>null</code> if
		 * abbreviation cannot be resolved
		 * @param {RegExp} regexp Regular expression for abbreviation element name
		 * @param {Function} fn Resolver function
		 * @param {Object} options Options list as described in 
		 * {@link HandlerList#add()} method
		 */
		addGenerator: function(regexp, fn, options) {
			if (_.isString(regexp))
				regexp = new RegExp(regexp);
			
			generators.add(function(node, syntax) {
				var m;
				if ((m = regexp.exec(node.name()))) {
					return fn(m, node, syntax);
				}
				
				return null;
			}, options);
		}
	});
	
	resources.addResolver(function(node, syntax) {
		return generators.exec(null, _.toArray(arguments));
	});
});/**
 * Module for resolving tag names: returns best matched tag name for child
 * element based on passed parent's tag name. Also provides utility function
 * for element type detection (inline, block-level, empty)
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.define('tagName', function(require, _) {
	var elementTypes = {
		empty: 'area,base,basefont,br,col,frame,hr,img,input,isindex,link,meta,param,embed,keygen,command'.split(','),
		blockLevel: 'address,applet,blockquote,button,center,dd,del,dir,div,dl,dt,fieldset,form,frameset,hr,iframe,ins,isindex,li,link,map,menu,noframes,noscript,object,ol,p,pre,script,table,tbody,td,tfoot,th,thead,tr,ul,h1,h2,h3,h4,h5,h6'.split(','),
		inlineLevel: 'a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,select,small,span,strike,strong,sub,sup,textarea,tt,u,var'.split(',')
	};
	
	var elementMap = {
		'p': 'span',
		'ul': 'li',
		'ol': 'li',
		'table': 'tr',
		'tr': 'td',
		'tbody': 'tr',
		'thead': 'tr',
		'tfoot': 'tr',
		'colgroup': 'col',
		'select': 'option',
		'optgroup': 'option',
		'audio': 'source',
		'video': 'source',
		'object': 'param',
		'map': 'area'
	};
	
	return {
		/**
		 * Returns best matched child element name for passed parent's
		 * tag name
		 * @param {String} name
		 * @returns {String}
		 * @memberOf tagName
		 */
		resolve: function(name) {
			name = (name || '').toLowerCase();
			
			if (name in elementMap)
				return this.getMapping(name);
			
			if (this.isInlineLevel(name))
				return 'span';
			
			return 'div';
		},
		
		/**
		 * Returns mapped child element name for passed parent's name 
		 * @param {String} name
		 * @returns {String}
		 */
		getMapping: function(name) {
			return elementMap[name.toLowerCase()];
		},
		
		/**
		 * Check if passed element name belongs to inline-level element
		 * @param {String} name
		 * @returns {Boolean}
		 */
		isInlineLevel: function(name) {
			return this.isTypeOf(name, 'inlineLevel');
		},
		
		/**
		 * Check if passed element belongs to block-level element.
		 * For better matching of unknown elements (for XML, for example), 
		 * you should use <code>!this.isInlineLevel(name)</code>
		 * @returns {Boolean}
		 */
		isBlockLevel: function(name) {
			return this.isTypeOf(name, 'blockLevel');
		},
		
		/**
		 * Check if passed element is void (i.e. should not have closing tag).
		 * @returns {Boolean}
		 */
		isEmptyElement: function(name) {
			return this.isTypeOf(name, 'empty');
		},
		
		/**
		 * Generic function for testing if element name belongs to specified
		 * elements collection
		 * @param {String} name Element name
		 * @param {String} type Collection name
		 * @returns {Boolean}
		 */
		isTypeOf: function(name, type) {
			return _.include(elementTypes[type], name);
		},
		
		/**
		 * Adds new parent–child mapping
		 * @param {String} parent
		 * @param {String} child
		 */
		addMapping: function(parent, child) {
			elementMap[parent] = child;
		},
		
		/**
		 * Removes parent-child mapping
		 */
		removeMapping: function(parent) {
			if (parent in elementMap)
				delete elementMap[parent];
		},
		
		/**
		 * Adds new element into collection
		 * @param {String} name Element name
		 * @param {String} collection Collection name
		 */
		addElementToCollection: function(name, collection) {
			if (!elementTypes[collection])
				elementTypes[collection] = [];
			
			var col = this.getCollection(collection);
			if (!_.include(col, name))
				col.push(name);
		},
		
		/**
		 * Removes element name from specified collection
		 * @param {String} name Element name
		 * @param {String} collection Collection name
		 * @returns
		 */
		removeElementFromCollection: function(name, collection) {
			if (collection in elementTypes) {
				elementTypes[collection] = _.without(this.getCollection(collection), name);
			}
		},
		
		/**
		 * Returns elements name collection
		 * @param {String} name Collection name
		 * @returns {Array}
		 */
		getCollection: function(name) {
			return elementTypes[name];
		}
	};
});/**
 * Filter for aiding of writing elements with complex class names as described
 * in Yandex's BEM (Block, Element, Modifier) methodology. This filter will
 * automatically inherit block and element names from parent elements and insert
 * them into child element classes
 * @memberOf __bemFilterDefine
 * @constructor
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _) {
	var prefs = require('preferences');
	prefs.define('bem.elementSeparator', '__', 'Class name’s element separator.');
	prefs.define('bem.modifierSeparator', '_', 'Class name’s modifier separator.');
	prefs.define('bem.shortElementPrefix', '-', 
			'Symbol for describing short “block-element” notation. Class names '
			+ 'prefixed with this symbol will be treated as element name for parent‘s '
			+ 'block name. Each symbol instance traverses one level up in parsed ' 
			+ 'tree for block name lookup. Empty value will disable short notation.');
	
	var shouldRunHtmlFilter = false;
	
	function getSeparators() {
		return {
			element: prefs.get('bem.elementSeparator'),
			modifier: prefs.get('bem.modifierSeparator')
		};
	}
	
	/**
	 * @param {AbbreviationNode} item
	 */
	function bemParse(item) {
		if (require('abbreviationUtils').isSnippet(item))
			return item;
		
		// save BEM stuff in cache for faster lookups
		item.__bem = {
			block: '',
			element: '',
			modifier: ''
		};
		
		var classNames = normalizeClassName(item.attribute('class')).split(' ');
		
		// guess best match for block name
		var reBlockName = /^[a-z]\-/i;
		item.__bem.block = _.find(classNames, function(name) {
			return reBlockName.test(name);
		});
		
		// guessing doesn't worked, pick first class name as block name
		if (!item.__bem.block) {
			reBlockName = /^[a-z]/i;
			item.__bem.block = _.find(classNames, function(name) {
				return reBlockName.test(name);
			}) || '';
		}
		
		classNames = _.chain(classNames)
			.map(function(name) {return processClassName(name, item);})
			.flatten()
			.uniq()
			.value()
			.join(' ');
		
		if (classNames)
			item.attribute('class', classNames);
		
		return item;
	}
	
	/**
	 * @param {String} className
	 * @returns {String}
	 */
	function normalizeClassName(className) {
		var utils = require('utils');
		className = (' ' + (className || '') + ' ').replace(/\s+/g, ' ');
		
		var shortSymbol = prefs.get('bem.shortElementPrefix');
		if (shortSymbol) {
			var re = new RegExp('\\s(' + utils.escapeForRegexp(shortSymbol) + '+)', 'g');
			className = className.replace(re, function(str, p1) {
				return ' ' + utils.repeatString(getSeparators().element, p1.length);
			});
		}
		
		return utils.trim(className);
	}
	
	/**
	 * Processes class name
	 * @param {String} name Class name item to process
	 * @param {AbbreviationNode} item Host node for provided class name
	 * @returns Processed class name. May return <code>Array</code> of
	 * class names 
	 */
	function processClassName(name, item) {
		name = transformClassName(name, item, 'element');
		name = transformClassName(name, item, 'modifier');
		
		// expand class name
		// possible values:
		// * block__element
		// * block__element_modifier
		// * block__element_modifier1_modifier2
		// * block_modifier
		var block = '', element = '', modifier = '';
		var separators = getSeparators();
		if (~name.indexOf(separators.element)) {
			var blockElem = name.split(separators.element);
			var elemModifiers = blockElem[1].split(separators.modifier);
			
			block = blockElem[0];
			element = elemModifiers.shift();
			modifier = elemModifiers.join(separators.modifier);
		} else if (~name.indexOf(separators.modifier)) {
			var blockModifiers = name.split(separators.modifier);
			
			block = blockModifiers.shift();
			modifier = blockModifiers.join(separators.modifier);
		}
		
		if (block || element || modifier) {
			if (!block) {
				block = item.__bem.block;
			}
			
			// inherit parent bem element, if exists
//			if (item.parent && item.parent.__bem && item.parent.__bem.element)
//				element = item.parent.__bem.element + separators.element + element;
			
			// produce multiple classes
			var prefix = block;
			var result = [];
			
			if (element) {
				prefix += separators.element + element;
				result.push(prefix);
			} else {
				result.push(prefix);
			}
			
			if (modifier) {
				result.push(prefix + separators.modifier + modifier);
			}
			
			item.__bem.block = block;
			item.__bem.element = element;
			item.__bem.modifier = modifier;
			
			return result;
		}
		
		// ...otherwise, return processed or original class name
		return name;
	}
	
	/**
	 * Low-level function to transform user-typed class name into full BEM class
	 * @param {String} name Class name item to process
	 * @param {AbbreviationNode} item Host node for provided class name
	 * @param {String} entityType Type of entity to be tried to transform 
	 * ('element' or 'modifier')
	 * @returns {String} Processed class name or original one if it can't be
	 * transformed
	 */
	function transformClassName(name, item, entityType) {
		var separators = getSeparators();
		var reSep = new RegExp('^(' + separators[entityType] + ')+', 'g');
		if (reSep.test(name)) {
			var depth = 0; // parent lookup depth
			var cleanName = name.replace(reSep, function(str, p1) {
				depth = str.length / separators[entityType].length;
				return '';
			});
			
			// find donor element
			var donor = item;
			while (donor.parent && depth--) {
				donor = donor.parent;
			}
			
			if (!donor || !donor.__bem)
				donor = item;
			
			if (donor && donor.__bem) {
				var prefix = donor.__bem.block;
				
				// decide if we should inherit element name
//				if (entityType == 'element') {
//					var curElem = cleanName.split(separators.modifier, 1)[0];
//					if (donor.__bem.element && donor.__bem.element != curElem)
//						prefix += separators.element + donor.__bem.element;
//				}
				
				if (entityType == 'modifier' &&  donor.__bem.element)
					prefix += separators.element + donor.__bem.element;
				
				return prefix + separators[entityType] + cleanName;
			}
		}
		
		return name;
	}
	
	/**
	 * Recursive function for processing tags, which extends class names 
	 * according to BEM specs: http://bem.github.com/bem-method/pages/beginning/beginning.ru.html
	 * <br><br>
	 * It does several things:<br>
	 * <ul>
	 * <li>Expands complex class name (according to BEM symbol semantics):
	 * .block__elem_modifier → .block.block__elem.block__elem_modifier
	 * </li>
	 * <li>Inherits block name on child elements: 
	 * .b-block > .__el > .__el → .b-block > .b-block__el > .b-block__el__el
	 * </li>
	 * <li>Treats first dash symbol as '__'</li>
	 * <li>Double underscore (or typographic '–') is also treated as an element 
	 * level lookup, e.g. ____el will search for element definition in parent’s 
	 * parent element:
	 * .b-block > .__el1 > .____el2 → .b-block > .b-block__el1 > .b-block__el2
	 * </li>
	 * </ul>
	 * 
	 * @param {AbbreviationNode} tree
	 * @param {Object} profile
	 */
	function process(tree, profile) {
		if (tree.name)
			bemParse(tree, profile);
		
		var abbrUtils = require('abbreviationUtils');
		_.each(tree.children, function(item) {
			process(item, profile);
			if (!abbrUtils.isSnippet(item) && item.start)
				shouldRunHtmlFilter = true;
		});
		
		return tree;
	};
	
	require('filters').add('bem', function(tree, profile) {
		shouldRunHtmlFilter = false;
		tree = process(tree, profile);
		// in case 'bem' filter is applied after 'html' filter: run it again
		// to update output
		if (shouldRunHtmlFilter) {
			tree = require('filters').apply(tree, 'html', profile);
		}
		
		return tree;
	});
});

/**
 * Comment important tags (with 'id' and 'class' attributes)
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * @constructor
 * @memberOf __commentFilterDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _) {
	// define some preferences
	/** @type emmet.preferences */
	var prefs = require('preferences');
	
	prefs.define('filter.commentAfter', 
			'\n<!-- /<%= attr("id", "#") %><%= attr("class", ".") %> -->',
			'A definition of comment that should be placed <i>after</i> matched '
			+ 'element when <code>comment</code> filter is applied. This definition '
			+ 'is an ERB-style template passed to <code>_.template()</code> '
			+ 'function (see Underscore.js docs for details). In template context, '
			+ 'the following properties and functions are availabe:\n'
			+ '<ul>'
			
			+ '<li><code>attr(name, before, after)</code> – a function that outputs' 
			+ 'specified attribute value concatenated with <code>before</code> ' 
			+ 'and <code>after</code> strings. If attribute doesn\'t exists, the ' 
			+ 'empty string will be returned.</li>'
			
			+ '<li><code>node</code> – current node (instance of <code>AbbreviationNode</code>)</li>'
			
			+ '<li><code>name</code> – name of current tag</li>'
			
			+ '<li><code>padding</code> – current string padding, can be used ' 
			+ 'for formatting</li>'
			
			+'</ul>');
	
	prefs.define('filter.commentBefore', 
			'',
			'A definition of comment that should be placed <i>before</i> matched '
			+ 'element when <code>comment</code> filter is applied. '
			+ 'For more info, read description of <code>filter.commentAfter</code> '
			+ 'property');
	
	prefs.define('filter.commentTrigger', 'id, class',
			'A comma-separated list of attribute names that should exist in abbreviatoin '
			+ 'where comment should be added. If you wish to add comment for '
			+ 'every element, set this option to <code>*</code>');
	
	/**
	 * Add comments to tag
	 * @param {AbbreviationNode} node
	 */
	function addComments(node, templateBefore, templateAfter) {
		var utils = require('utils');
		
		// check if comments should be added
		var trigger = prefs.get('filter.commentTrigger');
		if (trigger != '*') {
			var shouldAdd = _.find(trigger.split(','), function(name) {
				return !!node.attribute(utils.trim(name));
			});
			if (!shouldAdd) return;
		}
		
		var ctx = {
			node: node,
			name: node.name(),
			padding: node.parent ? node.parent.padding : '',
			attr: function(name, before, after) {
				var attr = node.attribute(name);
				if (attr) {
					return (before || '') + attr + (after || '');
				}
				
				return '';
			}
		};
		
		var nodeBefore = utils.normalizeNewline(templateBefore ? templateBefore(ctx) : '');
		var nodeAfter = utils.normalizeNewline(templateAfter ? templateAfter(ctx) : '');
		
		node.start = node.start.replace(/</, nodeBefore + '<');
		node.end = node.end.replace(/>/, '>' + nodeAfter);
	}
	
	function process(tree, before, after) {
		var abbrUtils = require('abbreviationUtils');
		_.each(tree.children, function(item) {
			if (abbrUtils.isBlock(item))
				addComments(item, before, after);
			
			process(item, before, after);
		});
			
		return tree;
	}
	
	require('filters').add('c', function(tree) {
		var templateBefore = _.template(prefs.get('filter.commentBefore'));
		var templateAfter = _.template(prefs.get('filter.commentAfter'));
		
		return process(tree, templateBefore, templateAfter);
	});
});
/**
 * Filter for escaping unsafe XML characters: <, >, &
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 */emmet.exec(function(require, _) {
	var charMap = {
		'<': '&lt;',
		'>': '&gt;',
		'&': '&amp;'
	};
	
	function escapeChars(str) {
		return str.replace(/([<>&])/g, function(str, p1){
			return charMap[p1];
		});
	}
	
	require('filters').add('e', function process(tree) {
		_.each(tree.children, function(item) {
			item.start = escapeChars(item.start);
			item.end = escapeChars(item.end);
			item.content = escapeChars(item.content);
			process(item);
		});
		
		return tree;
	});
});/**
 * Generic formatting filter: creates proper indentation for each tree node,
 * placing "%s" placeholder where the actual output should be. You can use
 * this filter to preformat tree and then replace %s placeholder to whatever you
 * need. This filter should't be called directly from editor as a part 
 * of abbreviation.
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * @constructor
 * @memberOf __formatFilterDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _){
	var placeholder = '%s';
	
	function getIndentation() {
		return require('resources').getVariable('indentation');
	}
	
	/**
	 * Test if passed node has block-level sibling element
	 * @param {AbbreviationNode} item
	 * @return {Boolean}
	 */
	function hasBlockSibling(item) {
		return item.parent && require('abbreviationUtils').hasBlockChildren(item.parent);
	}
	
	/**
	 * Test if passed item is very first child in parsed tree
	 * @param {AbbreviationNode} item
	 */
	function isVeryFirstChild(item) {
		return item.parent && !item.parent.parent && !item.index();
	}
	
	/**
	 * Check if a newline should be added before element
	 * @param {AbbreviationNode} node
	 * @param {OutputProfile} profile
	 * @return {Boolean}
	 */
	function shouldAddLineBreak(node, profile) {
		var abbrUtils = require('abbreviationUtils');
		if (profile.tag_nl === true || abbrUtils.isBlock(node))
			return true;
		
		if (!node.parent || !profile.inline_break)
			return false;
		
		// check if there are required amount of adjacent inline element
		var nodeCount = 0;
		return !!_.find(node.parent.children, function(child) {
			if (child.isTextNode() || !abbrUtils.isInline(child))
				nodeCount = 0;
			else if (abbrUtils.isInline(child))
				nodeCount++;
			
			if (nodeCount >= profile.inline_break)
				return true;
		});
	}
	
	/**
	 * Need to add newline because <code>item</code> has too many inline children
	 * @param {AbbreviationNode} node
	 * @param {OutputProfile} profile
	 */
	function shouldBreakChild(node, profile) {
		// we need to test only one child element, because 
		// hasBlockChildren() method will do the rest
		return node.children.length && shouldAddLineBreak(node.children[0], profile);
	}
	
	/**
	 * Processes element with matched resource of type <code>snippet</code>
	 * @param {AbbreviationNode} item
	 * @param {OutputProfile} profile
	 * @param {Number} level Depth level
	 */
	function processSnippet(item, profile, level) {
		if (!isVeryFirstChild(item)) {
			item.start = require('utils').getNewline() + item.start;
		}
		
		return item;
	}
	
	/**
	 * Processes element with <code>tag</code> type
	 * @param {AbbreviationNode} item
	 * @param {OutputProfile} profile
	 * @param {Number} level Depth level
	 */
	function processTag(item, profile, level) {
		item.start = item.end = placeholder;
		var utils = require('utils');
		var abbrUtils = require('abbreviationUtils');
		var isUnary = abbrUtils.isUnary(item);
		var nl = utils.getNewline();
			
		// formatting output
		if (profile.tag_nl !== false) {
			var forceNl = profile.tag_nl === true && (profile.tag_nl_leaf || item.children.length);
			
			// formatting block-level elements
			if (!item.isTextNode()) {
				if (shouldAddLineBreak(item, profile)) {
					// - do not indent the very first element
					// - do not indent first child of a snippet
					if (!isVeryFirstChild(item) && (!abbrUtils.isSnippet(item.parent) || item.index()))
						item.start = nl + item.start;
						
					if (abbrUtils.hasBlockChildren(item) || shouldBreakChild(item, profile) || (forceNl && !isUnary))
						item.end = nl + item.end;
						
					if (abbrUtils.hasTagsInContent(item) || (forceNl && !item.children.length && !isUnary))
						item.start += nl + getIndentation();
				} else if (abbrUtils.isInline(item) && hasBlockSibling(item) && !isVeryFirstChild(item)) {
					item.start = nl + item.start;
				} else if (abbrUtils.isInline(item) && abbrUtils.hasBlockChildren(item)) {
					item.end = nl + item.end;
				}
				
				item.padding = getIndentation() ;
			}
		}
		
		return item;
	}
	
	/**
	 * Processes simplified tree, making it suitable for output as HTML structure
	 * @param {AbbreviationNode} tree
	 * @param {OutputProfile} profile
	 * @param {Number} level Depth level
	 */
	require('filters').add('_format', function process(tree, profile, level) {
		level = level || 0;
		var abbrUtils = require('abbreviationUtils');
		
		_.each(tree.children, function(item) {
			if (abbrUtils.isSnippet(item))
				processSnippet(item, profile, level);
			else
				processTag(item, profile, level);
			
			process(item, profile, level + 1);
		});
		
		return tree;
	});
});/**
 * Filter for producing HAML code from abbreviation.
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * @constructor
 * @memberOf __hamlFilterDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _) {
	var childToken = '${child}';
	
	function transformClassName(className) {
		return require('utils').trim(className).replace(/\s+/g, '.');
	}
	
	/**
	 * Creates HAML attributes string from tag according to profile settings
	 * @param {AbbreviationNode} tag
	 * @param {Object} profile
	 */
	function makeAttributesString(tag, profile) {
		var attrs = '';
		var otherAttrs = [];
		var attrQuote = profile.attributeQuote();
		var cursor = profile.cursor();
		
		_.each(tag.attributeList(), function(a) {
			var attrName = profile.attributeName(a.name);
			switch (attrName.toLowerCase()) {
				// use short notation for ID and CLASS attributes
				case 'id':
					attrs += '#' + (a.value || cursor);
					break;
				case 'class':
					attrs += '.' + transformClassName(a.value || cursor);
					break;
				// process other attributes
				default:
					otherAttrs.push(':' +attrName + ' => ' + attrQuote + (a.value || cursor) + attrQuote);
			}
		});
		
		if (otherAttrs.length)
			attrs += '{' + otherAttrs.join(', ') + '}';
		
		return attrs;
	}
	
	/**
	 * Test if passed node has block-level sibling element
	 * @param {AbbreviationNode} item
	 * @return {Boolean}
	 */
	function hasBlockSibling(item) {
		return item.parent && item.parent.hasBlockChildren();
	}
	
	/**
	 * Processes element with <code>tag</code> type
	 * @param {AbbreviationNode} item
	 * @param {OutputProfile} profile
	 * @param {Number} level Depth level
	 */
	function processTag(item, profile, level) {
		if (!item.parent)
			// looks like it's root element
			return item;
		
		var abbrUtils = require('abbreviationUtils');
		var utils = require('utils');
		
		var attrs = makeAttributesString(item, profile);
		var cursor = profile.cursor();
		var isUnary = abbrUtils.isUnary(item);
		var selfClosing = profile.self_closing_tag && isUnary ? '/' : '';
		var start= '';
			
		// define tag name
		var tagName = '%' + profile.tagName(item.name());
		if (tagName.toLowerCase() == '%div' && attrs && attrs.indexOf('{') == -1)
			// omit div tag
			tagName = '';
			
		item.end = '';
		start = tagName + attrs + selfClosing + ' ';
		
		var placeholder = '%s';
		// We can't just replace placeholder with new value because
		// JavaScript will treat double $ character as a single one, assuming
		// we're using RegExp literal.
		item.start = utils.replaceSubstring(item.start, start, item.start.indexOf(placeholder), placeholder);
		
		if (!item.children.length && !isUnary)
			item.start += cursor;
		
		return item;
	}
	
	/**
	 * Processes simplified tree, making it suitable for output as HTML structure
	 * @param {AbbreviationNode} tree
	 * @param {Object} profile
	 * @param {Number} level Depth level
	 */
	require('filters').add('haml', function process(tree, profile, level) {
		level = level || 0;
		var abbrUtils = require('abbreviationUtils');
		
		if (!level) {
			tree = require('filters').apply(tree, '_format', profile);
		}
		
		_.each(tree.children, function(item) {
			if (!abbrUtils.isSnippet(item))
				processTag(item, profile, level);
			
			process(item, profile, level + 1);
		});
		
		return tree;
	});
});/**
 * Filter that produces HTML tree
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * @constructor
 * @memberOf __htmlFilterDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _) {
	/**
	 * Creates HTML attributes string from tag according to profile settings
	 * @param {AbbreviationNode} node
	 * @param {OutputProfile} profile
	 */
	function makeAttributesString(node, profile) {
		var attrQuote = profile.attributeQuote();
		var cursor = profile.cursor();
		
		return _.map(node.attributeList(), function(a) {
			var attrName = profile.attributeName(a.name);
			return ' ' + attrName + '=' + attrQuote + (a.value || cursor) + attrQuote;
		}).join('');
	}
	
	/**
	 * Processes element with <code>tag</code> type
	 * @param {AbbreviationNode} item
	 * @param {OutputProfile} profile
	 * @param {Number} level Depth level
	 */
	function processTag(item, profile, level) {
		if (!item.parent) // looks like it's root element
			return item;
		
		var abbrUtils = require('abbreviationUtils');
		var utils = require('utils');
		
		var attrs = makeAttributesString(item, profile); 
		var cursor = profile.cursor();
		var isUnary = abbrUtils.isUnary(item);
		var start= '';
		var end = '';
			
		// define opening and closing tags
		if (!item.isTextNode()) {
			var tagName = profile.tagName(item.name());
			if (isUnary) {
				start = '<' + tagName + attrs + profile.selfClosing() + '>';
				item.end = '';
			} else {
				start = '<' + tagName + attrs + '>';
				end = '</' + tagName + '>';
			}
		}
		
		var placeholder = '%s';
		// We can't just replace placeholder with new value because
		// JavaScript will treat double $ character as a single one, assuming
		// we're using RegExp literal.
		item.start = utils.replaceSubstring(item.start, start, item.start.indexOf(placeholder), placeholder);
		item.end = utils.replaceSubstring(item.end, end, item.end.indexOf(placeholder), placeholder);
		
		if (!item.children.length && !isUnary && item.content.indexOf(cursor) == -1)
			item.start += cursor;
		
		return item;
	}
	
	/**
	 * Processes simplified tree, making it suitable for output as HTML structure
	 * @param {AbbreviationNode} tree
	 * @param {Object} profile
	 * @param {Number} level Depth level
	 */
	require('filters').add('html', function process(tree, profile, level) {
		level = level || 0;
		var abbrUtils = require('abbreviationUtils');
		
		if (!level) {
			tree = require('filters').apply(tree, '_format', profile);
		}
		
		_.each(tree.children, function(item) {
			if (!abbrUtils.isSnippet(item))
				processTag(item, profile, level);
			
			process(item, profile, level + 1);
		});
		
		return tree;
	});
});/**
 * Output abbreviation on a single line (i.e. no line breaks)
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * @constructor
 * @memberOf __singleLineFilterDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _) {
	var rePad = /^\s+/;
	var reNl = /[\n\r]/g;
	
	require('filters').add('s', function process(tree, profile, level) {
		var abbrUtils = require('abbreviationUtils');
		
		_.each(tree.children, function(item) {
			if (!abbrUtils.isSnippet(item)) {
				// remove padding from item 
				item.start = item.start.replace(rePad, '');
				item.end = item.end.replace(rePad, '');
			}
			
			// remove newlines 
			item.start = item.start.replace(reNl, '');
			item.end = item.end.replace(reNl, '');
			item.content = item.content.replace(reNl, '');
			
			process(item);
		});
		
		return tree;
	});
});/**
 * Trim filter: removes characters at the beginning of the text
 * content that indicates lists: numbers, #, *, -, etc.
 * 
 * Useful for wrapping lists with abbreviation.
 * 
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @constructor
 * @memberOf __trimFilterDefine
 * @param {Function} require
 * @param {Underscore} _
 */
emmet.exec(function(require, _) {
	require('preferences').define('filter.trimRegexp', '[\\s|\\u00a0]*[\\d|#|\\-|\*|\\u2022]+\\.?\\s*',
			'Regular expression used to remove list markers (numbers, dashes, ' 
			+ 'bullets, etc.) in <code>t</code> (trim) filter. The trim filter '
			+ 'is useful for wrapping with abbreviation lists, pased from other ' 
			+ 'documents (for example, Word documents).');
	
	function process(tree, re) {
		_.each(tree.children, function(item) {
			if (item.content)
				item.content = item.content.replace(re, '');
			
			process(item, re);
		});
		
		return tree;
	}
	
	require('filters').add('t', function(tree) {
		var re = new RegExp(require('preferences').get('filter.trimRegexp'));
		return process(tree, re);
	});
});/**
 * Filter for trimming "select" attributes from some tags that contains
 * child elements
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @constructor
 * @memberOf __xslFilterDefine
 * @param {Function} require
 * @param {Underscore} _
 */emmet.exec(function(require, _) {
	var tags = {
		'xsl:variable': 1,
		'xsl:with-param': 1
	};
	
	/**
	 * Removes "select" attribute from node
	 * @param {AbbreviationNode} node
	 */
	function trimAttribute(node) {
		node.start = node.start.replace(/\s+select\s*=\s*(['"]).*?\1/, '');
	}
	
	require('filters').add('xsl', function process(tree) {
		var abbrUtils = require('abbreviationUtils');
		_.each(tree.children, function(item) {
			if (!abbrUtils.isSnippet(item)
					&& (item.name() || '').toLowerCase() in tags 
					&& item.children.length)
				trimAttribute(item);
			process(item);
		});
		
		return tree;
	});
});/**
 * "Lorem ipsum" text generator. Matches <code>lipsum(num)?</code> or 
 * <code>lorem(num)?</code> abbreviation.
 * This code is based on Django's contribution: 
 * https://code.djangoproject.com/browser/django/trunk/django/contrib/webdesign/lorem_ipsum.py
 * <br><br>
 * Examples to test:<br>
 * <code>lipsum</code> – generates 30 words text.<br>
 * <code>lipsum*6</code> – generates 6 paragraphs (autowrapped with &lt;p&gt; element) of text.<br>
 * <code>ol>lipsum10*5</code> — generates ordered list with 5 list items (autowrapped with &lt;li&gt; tag)
 * with text of 10 words on each line<br>
 * <code>span*3>lipsum20</code> – generates 3 paragraphs of 20-words text, each wrapped with &lt;span&gt; element .
 * Each paragraph phrase is unique   
 * @param {Function} require
 * @param {Underscore} _ 
 * @constructor
 * @memberOf __loremIpsumGeneratorDefine
 */
emmet.exec(function(require, _) {
	/**
	 * @param {AbbreviationNode} tree
	 * @param {Object} options
	 */
	require('abbreviationParser').addPreprocessor(function(tree, options) {
		var re = /^(?:lorem|lipsum)(\d*)$/i, match;
		
		/** @param {AbbreviationNode} node */
		tree.findAll(function(node) {
			if (node._name && (match = node._name.match(re))) {
				var wordCound = match[1] || 30;
				
				// force node name resolving if node should be repeated
				// or contains attributes. In this case, node should be outputed
				// as tag, otherwise as text-only node
				node._name = '';
				node.data('forceNameResolving', node.isRepeating() || node.attributeList().length);
				node.data('pasteOverwrites', true);
				node.data('paste', function(i, content) {
					return paragraph(wordCound, !i);
				});
			}
		});
	});
	
	var COMMON_P = 'lorem ipsum dolor sit amet consectetur adipisicing elit'.split(' ');
	
	var WORDS = ['exercitationem', 'perferendis', 'perspiciatis', 'laborum', 'eveniet',
	             'sunt', 'iure', 'nam', 'nobis', 'eum', 'cum', 'officiis', 'excepturi',
	             'odio', 'consectetur', 'quasi', 'aut', 'quisquam', 'vel', 'eligendi',
	             'itaque', 'non', 'odit', 'tempore', 'quaerat', 'dignissimos',
	             'facilis', 'neque', 'nihil', 'expedita', 'vitae', 'vero', 'ipsum',
	             'nisi', 'animi', 'cumque', 'pariatur', 'velit', 'modi', 'natus',
	             'iusto', 'eaque', 'sequi', 'illo', 'sed', 'ex', 'et', 'voluptatibus',
	             'tempora', 'veritatis', 'ratione', 'assumenda', 'incidunt', 'nostrum',
	             'placeat', 'aliquid', 'fuga', 'provident', 'praesentium', 'rem',
	             'necessitatibus', 'suscipit', 'adipisci', 'quidem', 'possimus',
	             'voluptas', 'debitis', 'sint', 'accusantium', 'unde', 'sapiente',
	             'voluptate', 'qui', 'aspernatur', 'laudantium', 'soluta', 'amet',
	             'quo', 'aliquam', 'saepe', 'culpa', 'libero', 'ipsa', 'dicta',
	             'reiciendis', 'nesciunt', 'doloribus', 'autem', 'impedit', 'minima',
	             'maiores', 'repudiandae', 'ipsam', 'obcaecati', 'ullam', 'enim',
	             'totam', 'delectus', 'ducimus', 'quis', 'voluptates', 'dolores',
	             'molestiae', 'harum', 'dolorem', 'quia', 'voluptatem', 'molestias',
	             'magni', 'distinctio', 'omnis', 'illum', 'dolorum', 'voluptatum', 'ea',
	             'quas', 'quam', 'corporis', 'quae', 'blanditiis', 'atque', 'deserunt',
	             'laboriosam', 'earum', 'consequuntur', 'hic', 'cupiditate',
	             'quibusdam', 'accusamus', 'ut', 'rerum', 'error', 'minus', 'eius',
	             'ab', 'ad', 'nemo', 'fugit', 'officia', 'at', 'in', 'id', 'quos',
	             'reprehenderit', 'numquam', 'iste', 'fugiat', 'sit', 'inventore',
	             'beatae', 'repellendus', 'magnam', 'recusandae', 'quod', 'explicabo',
	             'doloremque', 'aperiam', 'consequatur', 'asperiores', 'commodi',
	             'optio', 'dolor', 'labore', 'temporibus', 'repellat', 'veniam',
	             'architecto', 'est', 'esse', 'mollitia', 'nulla', 'a', 'similique',
	             'eos', 'alias', 'dolore', 'tenetur', 'deleniti', 'porro', 'facere',
	             'maxime', 'corrupti'];
	
	/**
	 * Returns random integer between <code>from</code> and <code>to</code> values
	 * @param {Number} from
	 * @param {Number} to
	 * @returns {Number}
	 */
	function randint(from, to) {
		return Math.round(Math.random() * (to - from) + from);
	}
	
	/**
	 * @param {Array} arr
	 * @param {Number} count
	 * @returns {Array}
	 */
	function sample(arr, count) {
		var len = arr.length;
		var iterations = Math.min(len, count);
		var result = [];
		while (result.length < iterations) {
			var randIx = randint(0, len - 1);
			if (!_.include(result, randIx))
				result.push(randIx);
		}
		
		return _.map(result, function(ix) {
			return arr[ix];
		});
	}
	
	function choice(val) {
		if (_.isString(val))
			return val.charAt(randint(0, val.length - 1));
		
		return val[randint(0, val.length - 1)];
	}
	
	function sentence(words, end) {
		if (words.length) {
			words[0] = words[0].charAt(0).toUpperCase() + words[0].substring(1);
		}
		
		return words.join(' ') + (end || choice('?!...')); // more dots that question marks
	}
	
	/**
	 * Insert commas at randomly selected words. This function modifies values
	 * inside <code>words</code> array 
	 * @param {Array} words
	 */
	function insertCommas(words) {
		var len = words.length;
		var totalCommas = 0;
		
		if (len > 3 && len <= 6) {
			totalCommas = randint(0, 1);
		} else if (len > 6 && len <= 12) {
			totalCommas = randint(0, 2);
		} else {
			totalCommas = randint(1, 4);
		}
		
		_.each(sample(_.range(totalCommas)), function(ix) {
			words[ix] += ',';
		});
	}
	
	/**
	 * Generate a paragraph of "Lorem ipsum" text
	 * @param {Number} wordCount Words count in paragraph
	 * @param {Boolean} startWithCommon Should paragraph start with common 
	 * "lorem ipsum" sentence.
	 * @returns {String}
	 */
	function paragraph(wordCount, startWithCommon) {
		var result = [];
		var totalWords = 0;
		var words;
		
		wordCount = parseInt(wordCount, 10);
		
		if (startWithCommon) {
			words = COMMON_P.slice(0, wordCount);
			if (words.length > 5)
				words[4] += ',';
			totalWords += words.length;
			result.push(sentence(words, '.'));
		}
		
		while (totalWords < wordCount) {
			words = sample(WORDS, Math.min(randint(3, 12) * randint(1, 5), wordCount - totalWords));
			totalWords += words.length;
			insertCommas(words);
			result.push(sentence(words));
		}
		
		return result.join(' ');
	}
});/**
 * A back-end bootstrap module with commonly used methods for loading user data
 * @param {Function} require
 * @param {Underscore} _  
 */
emmet.define('bootstrap', function(require, _) {
	
	/**
	 * Returns file name part from path
	 * @param {String} path Path to file
	 * @return {String}
	 */
	function getFileName(path) {
		var re = /([\w\.\-]+)$/i;
		var m = re.exec(path);
		return m ? m[1] : '';
	}
	
	/**
	 * Returns base path (path to folder of file)
	 * @param {String} path Path to file
	 * @return {String}
	 */
	function getBasePath(path) {
		return path.substring(0, path.length - getFileName(path).length);
	}
	
	return {
		/**
		 * Loads Emmet extensions. Extensions are simple .js files that
		 * uses Emmet modules and resources to create new actions, modify
		 * existing ones etc.
		 * @param {Array} fileList List of absolute paths to files in extensions 
		 * folder. Back-end app should not filter this list (e.g. by extension) 
		 * but return it "as-is" so bootstrap can decide how to load contents 
		 * of each file.
		 * This method requires a <code>file</code> module of <code>IEmmetFile</code> 
		 * interface to be implemented.
		 * @memberOf bootstrap
		 */
		loadExtensions: function(fileList) {
			var file = require('file');
			var payload = {};
			var utils = require('utils');
			var userSnippets = null;
			
			_.each(fileList, function(f) {
				switch (file.getExt(f)) {
					case 'js':
						try {
							eval(file.read(f));
						} catch (e) {
							emmet.log('Unable to eval "' + f + '" file: '+ e);
						}
						break;
					case 'json':
						var fileName = getFileName(f).toLowerCase().replace(/\.json$/, '');
						if (/^snippets/.test(fileName)) {
							if (fileName === 'snippets') {
								// data in snippets.json is more important to user
								userSnippets = this.parseJSON(file.read(f));
							} else {
								payload.snippets = utils.deepMerge(payload.snippets || {}, this.parseJSON(file.read(f)));
							}
						} else {
							payload[fileName] = file.read(f);
						}
						
						break;
				}
			}, this);
			
			if (userSnippets) {
				payload.snippets = utils.deepMerge(payload.snippets || {}, userSnippets);
			}
			
			this.loadUserData(payload);
		},
		
		/**
		 * Loads preferences from JSON object (or string representation of JSON)
		 * @param {Object} data
		 * @returns
		 */
		loadPreferences: function(data) {
			require('preferences').load(this.parseJSON(data));
		},
		
		/**
		 * Loads user snippets and abbreviations. It doesn’t replace current
		 * user resource vocabulary but merges it with passed one. If you need 
		 * to <i>replaces</i> user snippets you should call 
		 * <code>resetSnippets()</code> method first
		 */
		loadSnippets: function(data) {
			data = this.parseJSON(data);
			
			var res = require('resources');
			var userData = res.getVocabulary('user') || {};
			res.setVocabulary(require('utils').deepMerge(userData, data), 'user');
		},
		
		/**
		 * Helper function that loads default snippets, defined in project’s
		 * <i>snippets.json</i>
		 * @param {Object} data
		 */
		loadSystemSnippets: function(data) {
			require('resources').setVocabulary(this.parseJSON(data), 'system');
		},
		
		/**
		 * Removes all user-defined snippets
		 */
		resetSnippets: function() {
			require('resources').setVocabulary({}, 'user');
		},
		
		/**
		 * Helper function that loads all user data (snippets and preferences)
		 * defined as a single JSON object. This is useful for loading data 
		 * stored in a common storage, for example <code>NSUserDefaults</code>
		 * @param {Object} data
		 */
		loadUserData: function(data) {
			data = this.parseJSON(data);
			if (data.snippets) {
				this.loadSnippets(data.snippets);
			}
			
			if (data.preferences) {
				this.loadPreferences(data.preferences);
			}
			
			if (data.profiles) {
				this.loadProfiles(data.profiles);
			}
			
			var profiles = data.syntaxProfiles || data.syntaxprofiles;
			if (profiles) {
				this.loadSyntaxProfiles(profiles);
			}
		},
		
		/**
		 * Resets all user-defined data: preferences, snippets etc.
		 * @returns
		 */
		resetUserData: function() {
			this.resetSnippets();
			require('preferences').reset();
			require('profile').reset();
		},
		
		/**
		 * Load syntax-specific output profiles. These are essentially 
		 * an extension to syntax snippets 
		 * @param {Object} profiles Dictionary of profiles
		 */
		loadSyntaxProfiles: function(profiles) {
			profiles = this.parseJSON(profiles);
			var snippets = {};
			_.each(profiles, function(options, syntax) {
				if (!(syntax in snippets)) {
					snippets[syntax] = {};
				}
				snippets[syntax].profile = options;
			});
			
			this.loadSnippets(snippets);
		},
		
		/**
		 * Load named profiles
		 * @param {Object} profiles
		 */
		loadProfiles: function(profiles) {
			var profile = require('profile');
			_.each(this.parseJSON(profiles), function(options, name) {
				profile.create(name, options);
			});
		},
		
		/**
		 * Dead simple string-to-JSON parser
		 * @param {String} str
		 * @returns {Object}
		 */
		parseJSON: function(str) {
			if (_.isObject(str))
				return str;
			
			try {
				return (new Function('return ' + str))();
			} catch(e) {
				return {};
			}
		}
	};
});