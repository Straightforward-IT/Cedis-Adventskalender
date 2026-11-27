import { describe, expect, it } from 'vitest'
import { bag, BOW, cellsOf, clearRows, dropTarget, emptyBoard, fits, GOAL, HEIGHT, lock, restore, rotate, spawn, WIDTH } from './model.ts'

describe('Geschenke-Tetris', () => {
  it('lässt jedes Paket oben in der Mitte erscheinen', () => {
    for (let kind = 1; kind <= 7; kind++) {
      const p = spawn(kind)
      expect(fits(emptyBoard(), p)).toBe(true)
      expect(Math.min(...cellsOf(p).map(([, y]) => y))).toBe(0)
    }
  })

  it('dreht in vier Schritten wieder in die Grundstellung', () => {
    const board = emptyBoard()
    let p = { ...spawn(3), y: 5 }
    const start = cellsOf(p)
    for (let i = 0; i < 4; i++) p = rotate(board, p, 1)!
    expect(cellsOf(p)).toEqual(start)
  })

  it('schiebt ein Paket an der Wand beim Drehen zur Seite', () => {
    const board = emptyBoard()
    const upright = { ...rotate(board, { ...spawn(1), y: 4 }, 1)!, x: -2 }
    expect(fits(board, upright)).toBe(true)
    const turned = rotate(board, upright, 1)
    expect(turned).not.toBeNull()
    expect(cellsOf(turned!).every(([x]) => x >= 0)).toBe(true)
  })

  it('lässt fallen, legt ab und räumt volle Reihen', () => {
    let board = emptyBoard()
    board[HEIGHT - 1] = [1, 1, 1, 1, 1, 1, 0, 0, 0, 0]
    const p = dropTarget(board, { kind: 1, rot: 0, x: 6, y: 0 })
    expect(cellsOf(p).every(([, y]) => y === HEIGHT - 1)).toBe(true)
    const result = lock(board, p)
    expect(result.full).toEqual([HEIGHT - 1])
    expect(result.board[HEIGHT - 1][6]).toBe(1 + BOW)
    board = clearRows(result.board, result.full)
    expect(board.every((row) => row.every((c) => c === 0))).toBe(true)
    expect(board).toHaveLength(HEIGHT)
  })

  it('merkt, wenn der Stapel oben überläuft', () => {
    const board = emptyBoard()
    expect(lock(board, { kind: 2, rot: 0, x: 4, y: -1 }).overflow).toBe(true)
  })

  it('mischt jede Form genau einmal in den Sack', () => {
    expect(bag(() => 0.3).sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('stellt einen gemerkten Stand wieder her und verwirft Unsinn', () => {
    const board = emptyBoard()
    board[HEIGHT - 1][0] = 4
    expect(restore({ rows: 3, board })).toEqual({ rows: 3, board })
    expect(restore({ rows: 99, board: [[1]] })).toEqual({ rows: GOAL, board: emptyBoard() })
    expect(restore(undefined).board[0]).toHaveLength(WIDTH)
  })
})
