import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import { Package } from 'lucide-react'

import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'

const loginSchema = z.object({
  email: z.string().email({ message: 'Correo electrónico inválido' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
})

export const Login = () => {
  const { login, user, rol } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema)
  })

  useEffect(() => {
    if (user && rol) {
      if (rol === 'admin') navigate('/admin/dashboard', { replace: true })
      else if (rol === 'paqueteria') navigate('/paqueteria/pedidos', { replace: true })
    }
  }, [user, rol, navigate])

  const onSubmit = async (data) => {
    try {
      setLoading(true)
      await login(data.email, data.password)
      toast.success('Sesión iniciada correctamente')
      // Navigation is handled in useEffect when 'rol' becomes available
    } catch (error) {
      toast.error('Error al iniciar sesión', {
        description: error.message === 'Invalid login credentials' 
          ? 'Credenciales incorrectas' 
          : error.message
      })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-[#FF6600]">
          <Package size={48} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-[#1a1a2e]">
          Colivery
        </h2>
        <p className="mt-2 text-center text-sm text-[#6B7280]">
          Panel de Administración
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <Label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Correo electrónico
              </Label>
              <div className="mt-1">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </Label>
              <div className="mt-1">
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className={errors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  {...register('password')}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>
            </div>

            <div>
              <Button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#FF6600] hover:bg-[#e65c00] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF6600]"
                disabled={loading}
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
