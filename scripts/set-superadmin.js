const admin = require("../functions/node_modules/firebase-admin");
const serviceAccount = require("../serviceAccount.json");
const readline = require('readline');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setSuperAdmin(uid) {
  await admin.auth().setCustomUserClaims(uid, { superadmin: true, admin: true });

  console.log(`Usuário ${uid} agora é Super Admin.`);
}

// Create an interface for input and output
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function getInput(question) {
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });

};

async function main() {
    const answer = await getInput("Insira o uid do novo super admin: ");

    if (answer === '0') {
        return;
    }

    if (answer === '') {
        console.log("uid não colocado");
        return;
    }

    console.log(`Tornando usuário ${answer} em super admin...`);

    try {
        await setSuperAdmin(answer);
    } catch (err) {
        console.error(`occoreu um erro:`, err.message);
    }

    console.log("processo finalizado.");
    return;
}


main();
// Substitua pelo UID do usuário cadastrado no Firebase Auth
// setSuperAdmin("UID_DO_SUPER_ADMIN_AQUI");