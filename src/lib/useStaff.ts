'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export function useStaff() {
  const [staff, setStaff] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadStaff() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return setLoading(false)

      const { data } = await supabase
        .from('staff')
        .select('*, pharmacies(*)')
        .eq('auth_user_id', user.id)
        .single()

      setStaff(data)
      setLoading(false)
    }
    loadStaff()
  }, [])

  return { staff, loading }
}