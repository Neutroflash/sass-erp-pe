// Solo el módulo "bun:test" — a propósito, no `bun-types` completo (ese redefine globals como
// fetch/Response que pisarían los tipos DOM/Next.js del resto del proyecto). Los tests son la
// única parte del repo que corre con `bun test` en vez de Next.js.
/// <reference path="../../node_modules/bun-types/test.d.ts" />
