import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const DEFAULT_SUPABASE_REST_URL = "https://isiotbgafkdcdarlzhib.supabase.co/rest/v1/";
export const DEFAULT_SUPABASE_URL = "https://isiotbgafkdcdarlzhib.supabase.co";
export const DEFAULT_SUPABASE_KEY = "sb_publishable_o2-jG0NGzvPicurmCbMj7w_7DZMDlv3";

let supabaseUrl = DEFAULT_SUPABASE_URL;
let supabaseKey = DEFAULT_SUPABASE_KEY;
let supabase = null;

// Load environment variables asynchronously from .env with fallback
const loadEnv = async () => {
  const setSupabaseUrl = (restUrl) => {
    if (!restUrl) return;
    if (restUrl.endsWith('/rest/v1/')) {
      supabaseUrl = restUrl.replace('/rest/v1/', '');
    } else if (restUrl.endsWith('/rest/v1')) {
      supabaseUrl = restUrl.replace('/rest/v1', '');
    } else {
      supabaseUrl = restUrl;
    }
  };

  try {
    const res = await fetch('.env');
    if (res.ok) {
      const text = await res.text();
      const env = {};
      text.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts[1].trim().replace(/^['"]|['"]$/g, '');
          env[key] = value;
        }
      });
      
      let restUrl = env['DBSUPABASE'] || env['DB_SUPABASE'] || "";
      if (restUrl) setSupabaseUrl(restUrl);
      if (env['APKEY']) supabaseKey = env['APKEY'];
    }
  } catch (e) {
    // Expected when running inside native Android APK or offline
  }

  if (!supabaseUrl) supabaseUrl = DEFAULT_SUPABASE_URL;
  if (!supabaseKey) supabaseKey = DEFAULT_SUPABASE_KEY;
};

export const getSupabaseClient = async () => {
  if (!supabase) {
    await loadEnv();
    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey);
    } else {
      console.error("Supabase credentials not loaded.");
    }
  }
  return supabase;
};

// Login function
export const login = async (email, password) => {
  const client = await getSupabaseClient();
  if (!client) throw new Error("No se pudo conectar al cliente de Supabase.");

  // 1. Query user from custom 'usuario' table
  const { data: userData, error: userError } = await client
    .from('usuario')
    .select('*')
    .eq('mail', email)
    .single();

  if (userError || !userData) {
    throw new Error("Usuario no encontrado.");
  }

  if (!userData.activo) {
    throw new Error("El usuario está inactivo. Contacte al administrador.");
  }

  // 2. Validate password via bcrypt client-side comparison
  const bcryptLib = window.bcrypt || (window.dcodeIO && window.dcodeIO.bcrypt);
  if (!bcryptLib) {
    throw new Error("Librería Bcrypt no disponible.");
  }

  let isPasswordCorrect = false;
  try {
    isPasswordCorrect = bcryptLib.compareSync(password, userData.clave);
  } catch (err) {
    // If not a valid bcrypt hash, check plaintext direct match
    isPasswordCorrect = (password === userData.clave);
  }

  if (!isPasswordCorrect) {
    throw new Error("Contraseña incorrecta.");
  }

  // 3. Query user roles and permissions from database
  let roleData = null;
  let permissions = {};
  let userRolesData = [];
  
  try {
    const { data, error: userRolesError } = await client
      .from('user_roles')
      .select('*, roles(*)')
      .eq('user_id', userData.id);

    userRolesData = data || [];

    if (!userRolesError && userRolesData.length > 0) {
      // Collect all role IDs assigned to user
      const roleIds = userRolesData.map(ur => ur.roles_id);
      
      // Check if user has an admin role among their roles
      const adminRoleObj = userRolesData.find(ur => ur.roles && ((ur.roles.nombre || '').toLowerCase() === 'admin' || ur.roles.id === 1));
      const chosenRole = adminRoleObj ? adminRoleObj.roles : (userRolesData[0].roles || null);
      if (chosenRole) {
        roleData = {
          id: chosenRole.id,
          nombre: chosenRole.nombre,
          tipo: chosenRole.tipo,
          activo: chosenRole.activo
        };
      }
      
      // Query permissions from roles_permision table
      const { data: permissionsData } = await client
        .from('roles_permision')
        .select('*, objetos:objeto_id(id_vista)')
        .in('rol_id', roleIds)
        .eq('activo', true);
        
      if (permissionsData) {
        permissionsData.forEach(p => {
          if (p.objetos && p.objetos.id_vista) {
            const viewId = p.objetos.id_vista.trim();
            if (!permissions[viewId]) {
              permissions[viewId] = { leer: false, escribir: false };
            }
            if (p.leer) permissions[viewId].leer = true;
            if (p.escribir) permissions[viewId].escribir = true;
          }
        });
      }
    }
  } catch (err) {
    console.error("Error loading user roles and permissions from DB:", err);
  }

  // Fallback if no roles found or table query failed
  if (!roleData) {
    const userRoleString = (userData.rol || "usuario").toLowerCase();
    roleData = {
      id: userRoleString === 'admin' ? 1 : 2,
      nombre: userRoleString,
      activo: true
    };
  }

  // 4. Fetch Empresa information (first company)
  const { data: empresaData } = await client
    .from('empresa')
    .select('*')
    .limit(1)
    .single();

  // 5. Try authenticating via Supabase Auth for token/session management
  let session = null;
  try {
    const formattedEmail = email.includes('@') ? email : `${email}@empresas.com`;
    const authRes = await client.auth.signInWithPassword({
      email: formattedEmail,
      password: password
    });

    if (authRes.data && authRes.data.session) {
      session = authRes.data.session;
    } else {
      // Auto sign up since they exist in the custom table
      const signUpRes = await client.auth.signUp({
        email: formattedEmail,
        password: password
      });
      
      if (!signUpRes.error) {
        const retryRes = await client.auth.signInWithPassword({
          email: formattedEmail,
          password: password
        });
        if (retryRes.data && retryRes.data.session) {
          session = retryRes.data.session;
        }
      }
    }
  } catch (authErr) {
    console.warn("Supabase Auth flow failed or email confirmation required:", authErr);
  }

  // Fallback to local session if Supabase Auth is not fully configured
  if (!session) {
    session = {
      access_token: "mock-access-token-" + Date.now(),
      refresh_token: "mock-refresh-token-" + Date.now(),
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: userData.id,
        email: email.includes('@') ? email : `${email}@empresas.com`
      }
    };
  }

  const profile = {
    id: userData.id,
    nombre: userData.nombre,
    mail: userData.mail,
    ci: userData.ci,
    telefono: userData.telefono,
    activo: userData.activo,
    rol: roleData || { id: 3, nombre: "DEALER_MANAGER", tipo: "dealer access", activo: true },
    roles: (userRolesData || []).map(ur => ur.roles).filter(Boolean),
    empresa: empresaData || { id: 1, razon: "Empresas S.L.", rif: "J123", activo: true },
    permissions: permissions
  };

  // Save session details in localStorage for persistence
  localStorage.setItem('sb-session', JSON.stringify(session));
  localStorage.setItem('sb-profile', JSON.stringify(profile));

  return { session, profile };
};

// Logout function
export const logout = async () => {
  const client = await getSupabaseClient();
  if (client) {
    try {
      await client.auth.signOut();
    } catch (e) {
      console.warn("Sign out from auth service failed:", e);
    }
  }
  localStorage.removeItem('sb-session');
  localStorage.removeItem('sb-profile');
  window.location.href = 'login.html';
};
