import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fetchRound from './Questions.js'

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64')

const question = (text: string) => ({
  question: b64(text),
  correct_answer: b64('right'),
  incorrect_answers: [b64('w1'), b64('w2'), b64('w3')],
  difficulty: b64('easy'),
})

/**
 * Answer the two endpoints separately: the module holds a session token in
 * module state, so whether it asks for one first depends on what earlier tests
 * left behind. Dispatching on the URL keeps each test independent of that.
 */
const stubFetch = (...questionReplies: object[]) => {
  const calls: string[] = []
  let i = 0

  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url)

    const body = url.includes('api_token')
      ? { response_code: 0, token: `tok${i}` }
      : questionReplies[Math.min(i++, questionReplies.length - 1)]

    return { ok: true, json: async () => body }
  })

  return calls
}

/** The module rate-limits itself to one request per six seconds. Timers are
 *  faked so the wait costs the suite nothing; this drives it to completion. */
const fetchNow = async () => {
  const pending = fetchRound()
  await vi.runAllTimersAsync()
  return await pending
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('fetchRound', () => {
  it('decodes what OpenTDB sends and asks for the round it was given', async () => {
    const calls = stubFetch({ response_code: 0, results: [question('Who?')] })

    const [q] = await fetchNow()

    expect(q).toEqual({
      question: 'Who?',
      correctAnswer: 'right',
      incorrectAnswers: ['w1', 'w2', 'w3'],
      difficulty: 'easy',
    })
    expect(calls.at(-1)).toContain('encode=base64')
  })

  it('asks for two easy, two medium and one hard, in that order', async () => {
    const calls = stubFetch({ response_code: 0, results: [question('Q')] })

    await fetchNow()

    expect(calls.filter(url => !url.includes('api_token')).map(url => [
      new URL(url).searchParams.get('difficulty'),
      new URL(url).searchParams.get('amount'),
    ])).toEqual([['easy', '2'], ['medium', '2'], ['hard', '1']])
  })

  /**
   * The retry that matters: code 4 means this token has now seen every music
   * question there is. Without a new token trivia silently stops for the rest
   * of the night, which is exactly how it fails in a room — no error, just no
   * more rounds.
   */
  it('gets a new token when the old one has seen every question', async () => {
    const calls = stubFetch({ response_code: 4 }, { response_code: 0, results: [question('Again?')] })

    const questions = await fetchNow()

    expect(questions[0].question).toBe('Again?')
    expect(calls.filter(url => url.includes('api_token')).length).toBeGreaterThan(0)
  })

  it('gives the room nothing rather than throwing when the network is gone', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('ENOTFOUND')
    })

    await expect(fetchNow()).resolves.toEqual([])
  })

  it('gives the room nothing when OpenTDB refuses', async () => {
    stubFetch({ response_code: 5 })

    await expect(fetchNow()).resolves.toEqual([])
  })
})
