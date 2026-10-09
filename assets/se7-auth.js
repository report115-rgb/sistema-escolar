window.SE7={
 async api(action,data={},authenticated=true){
  const headers={'Content-Type':'application/json'};if(authenticated){await this.ready();const u=firebase.auth().currentUser;if(!u)throw new Error('Entre novamente.');headers.Authorization='Bearer '+await u.getIdToken();}
  const r=await fetch('/api/se7',{method:'POST',headers,body:JSON.stringify({action,...data})});let body;try{body=await r.json();}catch{throw new Error('O serviço de autenticação não está disponível. Verifique a implantação na Vercel.');}if(!r.ok)throw new Error(body.error||'Não foi possível concluir.');return body;
 },
 ready(){if(!this.readyPromise)this.readyPromise=new Promise(resolve=>{const cancel=firebase.auth().onAuthStateChanged(u=>{cancel();resolve(u);});});return this.readyPromise;},
 async staffLogin(email,password){await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);await firebase.auth().signInWithEmailAndPassword(email,password);try{const d=await this.api('session');if(!['master','secretaria','professor','financeiro','totem'].includes(d.role))throw new Error('Conta sem acesso administrativo.');await firebase.auth().currentUser.getIdToken(true);return d.profile;}catch(e){await firebase.auth().signOut();throw e;}},
 async studentLogin(cpf,password){const d=await this.api('student-login',{cpf,password},false);await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);await firebase.auth().signInWithCustomToken(d.customToken);return (await this.api('session')).profile;},
 async restore(kind){await this.ready();if(!firebase.auth().currentUser)return null;try{const d=await this.api('session');if(kind==='aluno'?d.role!=='aluno':kind==='financeiro'?!['master','financeiro'].includes(d.role):!['master','secretaria','professor','financeiro'].includes(d.role))return null;await firebase.auth().currentUser.getIdToken(true);return d.profile;}catch{return null;}},
 async logout(){await firebase.auth().signOut();['usuario_logado','app_financeiro_user','aluno_app_logado'].forEach(k=>sessionStorage.removeItem(k));location.reload();},
 async info(){return (await this.api('public-info',{},false)).institution;},
 async recover(email){if(!email)throw new Error('Informe seu e-mail.');firebase.auth().languageCode='pt-BR';await firebase.auth().sendPasswordResetEmail(email);}
};
