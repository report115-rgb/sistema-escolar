(() => {
        function formatarCPFCadastral(valor) {
            const original = String(valor ?? '').trim(), numeros = original.replace(/\D/g,'');
            return numeros.length === 11 ? numeros.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4') : original || '---';
        }
        function formatarWhatsAppCadastral(valor) {
            const original = String(valor ?? '').trim();let numeros = original.replace(/\D/g,'');
            if ((numeros.length === 12 || numeros.length === 13) && numeros.startsWith('55')) numeros = numeros.slice(2);
            if (numeros.length === 11) return numeros.replace(/^(\d{2})(\d{5})(\d{4})$/,'($1) $2-$3');
            if (numeros.length === 10) return numeros.replace(/^(\d{2})(\d{4})(\d{4})$/,'($1) $2-$3');
            return original || '---';
        }
        function formatarNascimentoCadastral(valor) {
            const original = String(valor ?? '').trim();
            const iso = original.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
            return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : original || '---';
        }
        function formatarEnderecoCadastral(aluno) {
            const texto = valor => String(valor ?? '').trim();
            const escolher = (...valores) => valores.map(texto).find(Boolean) || '';
            const normalizar = valor => texto(valor).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
            let rua = escolher(aluno.rua, aluno.street, aluno.logradouro, aluno.endereco, aluno.address);
            const numero = escolher(aluno.numero, aluno.number);
            const bairro = escolher(aluno.bairro, aluno.neighborhood);
            const cidade = escolher(aluno.cidade, aluno.city);
            const uf = escolher(aluno.estado, aluno.state);
            const complemento = escolher(aluno.complemento, aluno.complement);
            if (numero && !normalizar(rua).split(/[^a-z0-9/]+/).includes(normalizar(numero))) rua = rua ? `${rua}, nº ${numero}` : `nº ${numero}`;
            const partes = rua ? [rua] : [];
            const incluir = valor => {if (valor && !normalizar(partes.join(' ')).includes(normalizar(valor))) partes.push(valor);};
            incluir(bairro);incluir(complemento);
            if (cidade && !normalizar(partes.join(' ')).includes(normalizar(cidade))) incluir([cidade,uf].filter(Boolean).join('/'));
            else incluir(uf);
            const cep = texto(aluno.cep).replace(/\D/g,'');
            if (cep.length === 8 && !partes.join('').replace(/\D/g,'').includes(cep)) incluir('CEP '+cep.slice(0,5)+'-'+cep.slice(5));
            return partes.join(' - ') || '---';
        }

window.SE7Cadastro=Object.freeze({cpf:formatarCPFCadastral,whatsapp:formatarWhatsAppCadastral,endereco:formatarEnderecoCadastral,nascimento:formatarNascimentoCadastral,escape:value=>String(value??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))});
})();
