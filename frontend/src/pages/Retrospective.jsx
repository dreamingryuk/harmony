import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { configured, supabase } from '../lib/supabase'
import { Empty, Page } from '../components/Media'

export function Retrospective({ app }) {
  const [period, setPeriod] = useState('30d'),
    [events, setEvents] = useState([])
  useEffect(() => {
    if (configured)
      supabase
        .from('listening_events')
        .select('*')
        .eq('user_id', app.user.id)
        .order('played_at', { ascending: false })
        .then(({ data }) => setEvents(data || []))
  }, [app.user])
  const filtered = useMemo(() => {
    const date = new Date()
    if (period === '7d') date.setDate(date.getDate() - 7)
    if (period === '30d') date.setDate(date.getDate() - 30)
    if (period === 'month') date.setDate(1)
    return period === 'all' ? events : events.filter((event) => new Date(event.played_at) >= date)
  }, [events, period])
  const top = useMemo(
    () =>
      Object.values(
        filtered.reduce((all, event) => {
          const key = event.track.spotify_id
          all[key] ||= { name: event.track.title, count: 0 }
          all[key].count += 1
          return all
        }, {})
      )
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    [filtered]
  )
  const artists = useMemo(
    () =>
      Object.entries(
        filtered.reduce(
          (all, event) => ({
            ...all,
            [event.artist_name]: (all[event.artist_name] || 0) + 1,
          }),
          {}
        )
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    [filtered]
  )
  const genres = new Set(filtered.flatMap((event) => event.genres || []))
  return (
    <Page title="Sua Retrospectiva" subtitle="O que você ouviu no Harmony, período a período.">
      <div className="periods">
        {[
          ['7d', '7 dias'],
          ['30d', '30 dias'],
          ['month', 'Este mês'],
          ['all', 'Tudo'],
        ].map(([key, label]) => (
          <button
            className={period === key ? 'active' : ''}
            key={key}
            onClick={() => setPeriod(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {!filtered.length ? (
        <Empty text="Toque músicas no Harmony para a sua retrospectiva ganhar vida!" />
      ) : (
        <>
          <div className="metrics">
            {[
              ['Reproduções', filtered.length],
              ['Músicas diferentes', top.length],
              ['Artistas', artists.length],
              ['Gêneros', genres.size],
            ].map(([label, value]) => (
              <article className="metric" key={label}>
                <b>{value}</b>
                <span>{label}</span>
              </article>
            ))}
          </div>
          <div className="charts">
            <section>
              <h2>Top 5 músicas</h2>
              <ResponsiveContainer width="100%" height={270}>
                <BarChart data={top} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={130} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#14b881" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
            <section>
              <h2>Top artistas</h2>
              {artists.map(([name, count], index) => (
                <div className="rank" key={name}>
                  <span>{index + 1}</span>
                  <b>{name}</b>
                  <i style={{ width: `${Math.min(100, Math.max(0, (count / Math.max(artists[0]?.[1] || 1, 1)) * 100))}%` }} />
                  <small>{count} plays</small>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </Page>
  )
}
