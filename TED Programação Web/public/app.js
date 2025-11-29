// app.js
const API = '/api/reservas';

const form = document.getElementById('reservaForm');
const lista = document.getElementById('listaReservas');
const msg = document.getElementById('formMsg');

// funções utilitárias
function showMsg(text, ok = true) {
  msg.textContent = text;
  msg.style.color = ok ? 'green' : 'crimson';
  setTimeout(() => { msg.textContent = ''; }, 4000);
}

function toISODate(inputDate) {
  return inputDate; // o input type=date já entrega YYYY-MM-DD
}

// Função para formatar data de YYYY-MM-DD para DD/MM/YYYY
function formatarDataBr(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

// busca reservas do servidor
async function carregarReservas(){
  try {
    const res = await fetch(API);
    const dados = await res.json();
    renderReservas(dados);
    return dados;
  } catch (e) {
    console.error(e);
    showMsg('Erro ao carregar reservas', false);
    return [];
  }
}

function renderReservas(arr){
  lista.innerHTML = '';
  if (!arr.length) return lista.innerHTML = '<li>Nenhuma reserva</li>';
  arr.forEach(r => {
    // APLICANDO A FORMATAÇÃO BRASILEIRA NA DATA
    const dataFormatada = formatarDataBr(r.data);
    
    // CORREÇÃO: Substituir espaços normais por &nbsp; no nome para evitar quebras de linha indesejadas
    const nomeSemQuebra = escapeHtml(r.nome).replace(/ /g, '&nbsp;');
    
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${nomeSemQuebra}</strong>
        <div class="reserva-meta">Campo ${r.campo} • ${dataFormatada} às ${r.hora} • ${r.duracao}h</div>
      </div>
      <div>
        <button class="small-btn" data-id="${r.id}">Cancelar</button>
      </div>
    `;
    lista.appendChild(li);
  });
}

// proteção básica contra XSS
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[s]));
}

// validação personalizada
function validar(formData){
  // data mínima: hoje
  const hoje = new Date();
  const dataStr = formData.get('data');
  const dataSelecionada = new Date(dataStr + 'T00:00:00');
  if (!dataStr || isNaN(dataSelecionada)) return 'Data inválida';

  // comparar apenas a data (ignora hora)
  const hojeZero = new Date(hoje.toDateString());
  if (dataSelecionada < hojeZero) return 'A data deve ser hoje ou futura';

  // hora entre 06:00 e 23:00 e minutos devem ser 00 ou 30
  const hora = formData.get('hora');
  if (!/^\d{2}:\d{2}$/.test(hora)) return 'Hora inválida';
  const [hh, mm] = hora.split(':').map(Number);
  
  if (hh < 6 || hh > 23) return 'Horário disponível entre 06:00 e 23:00';
  
  // REGRA: Validar se os minutos são 00 ou 30
  if (mm !== 0 && mm !== 30) {
    return 'A reserva deve ser feita em hora exata (ex: 19:00) ou meia-hora (ex: 19:30).';
  }
  
  // duração
  const dur = Number(formData.get('duracao'));
  if (!(dur >=1 && dur <=6)) return 'Duração entre 1 e 6 horas';

  // celular simples
  const cel = formData.get('celular');
  if (!/^[0-9\+\-\s()]{8,20}$/.test(cel)) return 'Celular inválido';

  // campo
  const campo = formData.get('campo');
  if (!campo) return 'Selecione um campo';

  return null;
}

// evento submit
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const fd = new FormData(form);

  const err = validar(fd);
  if (err) return showMsg(err, false);

  const payload = {
    nome: fd.get('nome').trim(),
    celular: fd.get('celular').trim(),
    campo: Number(fd.get('campo')),
    data: toISODate(fd.get('data')),
    hora: fd.get('hora'),
    duracao: Number(fd.get('duracao'))
  };

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const j = await res.json();
      throw new Error(j.error || 'Erro ao criar reserva');
    }
    showMsg('Reserva criada com sucesso!');
    form.reset();
    await carregarReservas();
    carregarAgenda(); // atualizar agenda também
  } catch (e) {
    showMsg(e.message || 'Erro', false);
  }
});

// evento delegação para cancelar
lista.addEventListener('click', async (ev) => {
  if (ev.target.matches('button[data-id]')){
    const id = ev.target.dataset.id;
    if (!confirm('Confirmar cancelamento?')) return;
    const res = await fetch(API + '/' + id, { method: 'DELETE' });
    if (res.ok) { showMsg('Reserva cancelada'); await carregarReservas(); carregarAgenda(); }
    else { const j = await res.json(); showMsg(j.error||'Erro', false); }
  }
});

// AGENDA: mostra horários livres/reservados entre 06:00 e 23:00 (a cada 30 min)
async function carregarAgenda(){
  const data = document.getElementById('agendaData').value;
  const campo = document.getElementById('agendaCampo').value;
  if(!data) return;

  let reservas = [];
  try {
    const res = await fetch(API);
    reservas = await res.json();
  } catch (e) {
    console.error(e);
    showMsg('Erro ao carregar agenda', false);
  }

  const filtradas = reservas.filter(r => r.data === data && Number(r.campo) === Number(campo));

  const grid = document.getElementById('agendaGrid');
  grid.innerHTML = '';

  // horários a cada 30 minutos, de 06:00 a 23:00 (inclusivo)
  const horarios = [];
  for(let h=6; h<=23; h++){
    horarios.push(`${String(h).padStart(2,'0')}:00`);
    // Adicionar o intervalo de 30 minutos se a hora for antes das 23:00
    if (h < 23) { 
      horarios.push(`${String(h).padStart(2,'0')}:30`);
    }
  }

  horarios.forEach(h => {
    // LÓGICA CORRIGIDA: Checar se o slot está coberto por uma reserva existente
    const slotTime = new Date(data + 'T' + h + ':00'); // Hora do slot atual
    
    const reservado = filtradas.some(r => {
      // Constrói o tempo de início e fim da reserva
      const startTime = new Date(r.data + 'T' + r.hora + ':00');
      const durationMs = r.duracao * 3600000; // Duração em milissegundos
      const endTime = new Date(startTime.getTime() + durationMs);

      // O slot está reservado se a hora do slot for >= tempo de início E < tempo de fim
      return slotTime.getTime() >= startTime.getTime() && slotTime.getTime() < endTime.getTime();
    });
    
    const div=document.createElement('div');
    div.className='agenda-slot '+(reservado?'reservado':'disponivel');
    div.textContent=h+(reservado?' • Reservado':' • Livre');

    // opcional: ao clicar em um horário livre, preenche o form com data, hora e campo
    if(!reservado){
      div.style.cursor = 'pointer';
      div.title = 'Clique para preencher o formulário com este horário';
      div.addEventListener('click', () => {
        document.getElementById('data').value = data;
        document.getElementById('hora').value = h;
        document.getElementById('campo').value = campo;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    grid.appendChild(div);
  });
}

document.getElementById('agendaData').addEventListener('change',carregarAgenda);
document.getElementById('agendaCampo').addEventListener('change',carregarAgenda);

// carga inicial
carregarReservas().then(()=> {
  // colocar data de hoje no seletor da agenda por conveniência
  const hoje = new Date();
  const isoHoje = hoje.toISOString().slice(0,10);
  const agendaDateInput = document.getElementById('agendaData');
  if (!agendaDateInput.value) agendaDateInput.value = isoHoje;
  // e colocar data do form também (ajuda o usuário)
  const formDataInput = document.getElementById('data');
  if (!formDataInput.value) formDataInput.value = isoHoje;

  carregarAgenda();
});