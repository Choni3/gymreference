import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, parseStrong } from '../js/strong.js';

const HEADER = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE';

test('parseCSV handles quotes, escaped quotes and CRLF', () => {
  assert.deepEqual(parseCSV('a,b\r\n"x, y","say ""hi"""\r\n'), [['a', 'b'], ['x, y', 'say "hi"']]);
});

test('parseCSV detects semicolon delimiter', () => {
  assert.deepEqual(parseCSV('a;b\n1,5;2\n'), [['a', 'b'], ['1,5', '2']]);
});

test('parseStrong builds routines from the latest session of each workout', () => {
  const csv = [
    HEADER,
    '2024-01-01 10:00:00,Push A,1h,Bench Press (Barbell),1,60,5,,,,,',
    '2024-01-08 10:00:00,Push A,1h,Overhead Press (Barbell),W,20,10,,,,,',
    '2024-01-08 10:00:00,Push A,1h,Overhead Press (Barbell),1,40,8.0,,,,,',
    '2024-01-08 10:00:00,Push A,1h,Overhead Press (Barbell),2,40,8,,,,,',
    '2024-01-08 10:00:00,Push A,1h,"Bench Press (Barbell)",1,60,6,,,,,',
    '2024-01-09 10:00:00,Legs,1h,Squat (Barbell),1,80,5,,,,,',
  ].join('\n');
  const { exerciseNames, routines } = parseStrong(csv);
  assert.deepEqual(exerciseNames.sort(), ['Bench Press (Barbell)', 'Overhead Press (Barbell)', 'Squat (Barbell)']);
  assert.deepEqual(routines, [
    { name: 'Push A', items: [
      { name: 'Overhead Press (Barbell)', sets: 2, reps: '8' },
      { name: 'Bench Press (Barbell)', sets: 1, reps: '6' },
    ] },
    { name: 'Legs', items: [{ name: 'Squat (Barbell)', sets: 1, reps: '5' }] },
  ]);
});

test('parseStrong rejects non-Strong files', () => {
  assert.throws(() => parseStrong('foo,bar\n1,2\n'), /Strong export/);
});
