// Copyright 2020 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Flags: --allow-natives-syntax

assertTrue(%IsConcatSpreadableProtector());
Object.defineProperty(Array, Symbol.isConcatSpreadable, { value: false });
assertFalse(%IsConcatSpreadableProtector());
