// Copyright 2018 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Flags: --allow-natives-syntax

// This tests the interaction between the MapIterator protector and SetIterator
// protector.

var map = new Map([[1,2], [2,3], [3,4]]);
assertTrue(%MapIteratorProtector());

var set = new Set([1,2,3]);
assertTrue(%SetIteratorProtector());

// This changes %SetIteratorPrototype%. No more tests should be run after this
// in the same instance.
var iterator = set.keys();
iterator.__proto__[Symbol.iterator] = () => ({next: () => ({done: true})});

assertTrue(%MapIteratorProtector());
assertEquals([[1,2], [2,3], [3,4]], [...map]);
assertEquals([[1,2], [2,3], [3,4]], [...map.entries()]);
assertEquals([1,2,3], [...map.keys()]);
assertEquals([2,3,4], [...map.values()]);

assertFalse(%SetIteratorProtector());
assertEquals([], [...set.entries()]);
assertEquals([1,2,3], [...set]);
assertEquals([], [...set.keys()]);
assertEquals([], [...set.values()]);
