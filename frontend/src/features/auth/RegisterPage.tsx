import { useForm } from 'react-hook-form'
import { standardSchemaResolver as zodResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useRegister } from '@/hooks/useAuth'

const schema = z
  .object({
    display_name: z.string().min(1, 'Display name is required'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })
type FormData = z.infer<typeof schema>

export function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })
  const registerMutation = useRegister()

  const onSubmit = ({ display_name, email, password }: FormData) => {
    registerMutation.mutate({ display_name, email, password })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">FamilyBudget</CardTitle>
          <CardDescription>Create your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1">
              <Label htmlFor="display_name">Display Name</Label>
              <Input id="display_name" placeholder="Alex Smith" {...register('display_name')} />
              {errors.display_name && (
                <p className="text-sm text-destructive">{errors.display_name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register('email')}
                noValidate
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input
                id="confirm_password"
                type="password"
                placeholder="••••••••"
                {...register('confirm_password')}
              />
              {errors.confirm_password && (
                <p className="text-sm text-destructive">{errors.confirm_password.message}</p>
              )}
            </div>
            {registerMutation.isError && (
              <p className="text-sm text-destructive">
                Registration failed. Please try again.
              </p>
            )}
            <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? 'Creating account…' : 'Create Account'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
