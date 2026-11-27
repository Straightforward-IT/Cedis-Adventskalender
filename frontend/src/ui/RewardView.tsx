import { useEffect, useState } from 'react'
import { fetchReward } from '../api/client.ts'
import type { Reward } from '../api/types.ts'
import { useStore } from '../state/store.ts'

function Gift({ open }: { open: boolean }) {
  return (
    <svg className="gift" data-open={open} viewBox="0 0 140 150" aria-hidden="true">
      <g className="gift__sparkles" fill="#f2c14e">
        <path d="m24 34 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" />
        <path d="m116 26 2.5 6.5 6.5 2.5-6.5 2.5-2.5 6.5-2.5-6.5-6.5-2.5 6.5-2.5 2.5-6.5Z" />
        <path d="m70 6 2 5.5 5.5 2-5.5 2-2 5.5-2-5.5-5.5-2 5.5-2 2-5.5Z" />
      </g>
      <rect x="26" y="72" width="88" height="66" rx="8" fill="#c4463c" />
      <rect x="62" y="72" width="16" height="66" fill="#f2c14e" />
      <g className="gift__lid">
        <rect x="18" y="54" width="104" height="24" rx="7" fill="#d9584c" />
        <rect x="62" y="54" width="16" height="24" fill="#f2c14e" />
        <path
          d="M70 54c-14-22-34-8-14 0M70 54c14-22 34-8 14 0"
          fill="none"
          stroke="#f2c14e"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}

/** Nach dem Minispiel: Die Überraschung wird enthüllt – jetzt darf die echte Box geöffnet werden. */
export function RewardView({ day, onReplay }: { day: number; onReplay(): void }) {
  const [reward, setReward] = useState<Reward | null>(null)

  useEffect(() => {
    let cancelled = false
    const fallback: Reward = {
      day,
      title: `Türchen ${day}`,
      message: `Geschafft! Jetzt darfst du Box ${day} öffnen.`,
    }
    const key = useStore.getState().progress.keys[day]
    const request = key ? fetchReward(day, key) : Promise.resolve(fallback)
    request
      .catch(() => fallback)
      .then((result) => {
        if (!cancelled) setReward(result)
      })
    return () => {
      cancelled = true
    }
  }, [day])

  return (
    <div className="reward" role="status">
      <Gift open={reward !== null} />
      <h3>{reward ? reward.title : 'Trommelwirbel …'}</h3>
      <p>{reward?.message}</p>
      <button type="button" className="link" onClick={onReplay}>
        Noch einmal spielen
      </button>
    </div>
  )
}
