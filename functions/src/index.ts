import { onCall, HttpsError, type CallableRequest } from "firebase-functions/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth, UserRecord } from "firebase-admin/auth";

initializeApp();

// --- Interfaces para Tipagem dos Dados ---

interface AdminUserResponse {
  uid: string;
  email?: string;
  displayName: string;
  role: "superadmin" | "admin";
  disabled: boolean;
  createdAt: string;
}

interface AddAdminPayload {
  email: string;
  password?: string;
  displayName?: string;
}

interface UpdateAdminPayload {
  uid: string;
  displayName?: string;
  disabled?: boolean;
}

interface DeleteAdminPayload {
  uid: string;
  deleteAccount?: boolean;
}

// --- Helper de Autenticação ---

function checkSuperAdmin(request: CallableRequest<unknown>): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "O usuário precisa estar autenticado.");
  }
  
  const isSuperAdmin = request.auth.token.superadmin === true;
  if (!isSuperAdmin) {
    throw new HttpsError("permission-denied", "Apenas o Super Admin pode realizar esta ação.");
  }
}

// --- Functions ---

// 1. Listar todos os Administradores
export const listAdmins = onCall(async (request: CallableRequest): Promise<{ admins: AdminUserResponse[] }> => {
  checkSuperAdmin(request);

  const listUsersResult = await getAuth().listUsers(100);
  
  const admins: AdminUserResponse[] = listUsersResult.users
    .filter((user: UserRecord) => {
      const claims = user.customClaims || {};
      return claims.admin === true || claims.superadmin === true;
    })
    .map((user: UserRecord) => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || "Sem nome",
      role: user.customClaims?.superadmin ? "superadmin" : "admin",
      disabled: user.disabled,
      createdAt: user.metadata.creationTime,
    }));

  return { admins };
});

// 2. Criar ou Promover um Usuário a Admin
export const addAdmin = onCall(
  async (request: CallableRequest<AddAdminPayload>): Promise<{ message: string; uid: string }> => {
    checkSuperAdmin(request);

    const { email, password, displayName } = request.data;
    let user: UserRecord;

    try {
      user = await getAuth().getUserByEmail(email);
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        if (!password) {
          throw new HttpsError("invalid-argument", "Senha é obrigatória para criar um novo usuário.");
        }
        user = await getAuth().createUser({
          email,
          password,
          displayName,
        });
      } else {
        throw new HttpsError("internal", error.message);
      }
    }

    await getAuth().setCustomUserClaims(user.uid, { admin: true });

    return { message: `Usuário ${email} promovido a Admin com sucesso.`, uid: user.uid };
  }
);

// 3. Atualizar Status ou Dados do Admin
export const updateAdmin = onCall(
  async (request: CallableRequest<UpdateAdminPayload>): Promise<{ message: string }> => {
    checkSuperAdmin(request);

    const { uid, displayName, disabled } = request.data;

    await getAuth().updateUser(uid, {
      displayName,
      disabled,
    });

    return { message: "Administrador atualizado com sucesso." };
  }
);

// 4. Remover privilégio ou Excluir Admin
export const deleteAdmin = onCall(
  async (request: CallableRequest<DeleteAdminPayload>): Promise<{ message: string }> => {
    checkSuperAdmin(request);

    const { uid, deleteAccount } = request.data;

    if (uid === request.auth?.uid) {
      throw new HttpsError("invalid-argument", "Você não pode remover sua própria conta de Super Admin.");
    }

    if (deleteAccount) {
      await getAuth().deleteUser(uid);
    } else {
      await getAuth().setCustomUserClaims(uid, { admin: false });
    }

    return { message: "Operação realizada com sucesso." };
  }
);