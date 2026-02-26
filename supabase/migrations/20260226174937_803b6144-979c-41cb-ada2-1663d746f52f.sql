
-- 1. Add INSERT policy for profiles (needed for new user trigger)
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (id = auth.uid());

-- 2. Add DELETE policy for admins on profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Add explicit INSERT policy for user_roles (admins only)
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Add explicit UPDATE policy for user_roles (admins only)
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Add explicit DELETE policy for user_roles (admins only)
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
