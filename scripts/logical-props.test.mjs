import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findViolations } from './logical-props.mjs';

const flagged = (text) => findViolations(text).length > 0;

test('flags physical Tailwind utilities', () => {
  for (const sample of [
    '<div class="ml-4">',
    '<div class="flex mr-2 p-1">',
    '<div class="md:pl-6">',
    '<div class="hover:-ml-2">',
    '<div class="text-left">',
    '<div class="absolute left-0 top-0">',
    '<div class="right-1/2">',
    '<div class="border-l-2">',
    '<div class="rounded-tr-lg">',
    '<div class="float-right">',
  ]) {
    assert.ok(flagged(sample), sample);
  }
});

test('flags physical CSS', () => {
  for (const sample of [
    'margin-left: 1rem;',
    'padding-right: 2px;',
    'border-left: 1px solid;',
    'text-align: right;',
    '  left: 0;',
    'float: left;',
    'border-top-left-radius: 4px;',
  ]) {
    assert.ok(flagged(sample), sample);
  }
});

test('accepts logical utilities and CSS', () => {
  for (const sample of [
    '<div class="ms-4 me-2 ps-1 pe-3">',
    '<div class="text-start text-end">',
    '<div class="absolute start-0 end-4">',
    '<div class="border-s-2 rounded-ss-lg">',
    'margin-inline-start: 1rem;',
    'inset-inline-end: 0;',
    '<div class="shift-left-panel">',
    '<div class="flex-1 mt-4 mb-2">',
    "const leftover = 'x';",
  ]) {
    assert.ok(!flagged(sample), sample);
  }
});

test('honors the rtl-ok escape hatch', () => {
  assert.ok(!flagged('<div class="ml-4"> <!-- rtl-ok: icon is not directional -->'));
});
