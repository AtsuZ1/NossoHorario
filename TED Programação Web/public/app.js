const API = '/api/reservas';

const form = document.getElementById('reservaForm');
const lista = document.getElementById('listaReservas');
const msg = document.getElementById('formMsg');

function showMsg(text, ok = true) {
  msg.textContent = text;
  msg.style.color = ok ? 'green' : 'crimson';
  setTimeout(() => { msg.textContent = ''; }, 4000);
}

function toISODate(inputDate) {
  return inputDate;
}

function formatarDataBr(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

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
    const dataFormatada = formatarDataBr(r.data);
    
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

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[s]));
}

function validar(formData){
  const hoje = new Date();
  const dataStr = formData.get('data');
  const dataSelecionada = new Date(dataStr + 'T00:00:00');
  if (!dataStr || isNaN(dataSelecionada)) return 'Data inválida';

  const hojeZero = new Date(hoje.toDateString());
  if (dataSelecionada < hojeZero) return 'A data deve ser hoje ou futura';

  const hora = formData.get('hora');
  if (!/^\d{2}:\d{2}$/.test(hora)) return 'Hora inválida';
  const [hh, mm] = hora.split(':').map(Number);
  
  if (hh < 6 || hh > 23) return 'Horário disponível entre 06:00 e 23:00';
  
  if (mm !== 0 && mm !== 30) {
    return 'A reserva deve ser feita em hora exata (ex: 19:00) ou meia-hora (ex: 19:30).';
  }
  
  const dur = Number(formData.get('duracao'));
  if (!(dur >=1 && dur <=6)) return 'Duração entre 1 e 6 horas';

  const cel = formData.get('celular');
  if (!/^[0-9\+\-\s()]{8,20}$/.test(cel)) return 'Celular inválido';

  const campo = formData.get('campo');
  if (!campo) return 'Selecione um campo';

  return null;
}

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
    carregarAgenda();
  } catch (e) {
    showMsg(e.message || 'Erro', false);
  }
});

lista.addEventListener('click', async (ev) => {
  if (ev.target.matches('button[data-id]')){
    const id = ev.target.dataset.id;
    if (!confirm('Confirmar cancelamento?')) return;
    const res = await fetch(API + '/' + id, { method: 'DELETE' });
    if (res.ok) { showMsg('Reserva cancelada'); await carregarReservas(); carregarAgenda(); }
    else { const j = await res.json(); showMsg(j.error||'Erro', false); }
  }
});

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

  const horarios = [];
  for(let h=6; h<=23; h++){
    horarios.push(`${String(h).padStart(2,'0')}:00`);
    if (h < 23) { 
      horarios.push(`${String(h).padStart(2,'0')}:30`);
    }
  }

  horarios.forEach(h => {
    const slotTime = new Date(data + 'T' + h + ':00');
    const reservado = filtradas.some(r => {
      const startTime = new Date(r.data + 'T' + r.hora + ':00');
      const durationMs = r.duracao * 3600000;
      const endTime = new Date(startTime.getTime() + durationMs);

        return slotTime.getTime() >= startTime.getTime() && slotTime.getTime() < endTime.getTime();
    });

    const div=document.createElement('div');
    div.className='agenda-slot '+(reservado?'reservado':'disponivel');
    div.textContent=h+(reservado?' • Reservado':' • Livre');

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

carregarReservas().then(()=> {
  const hoje = new Date();
  const isoHoje = hoje.toISOString().slice(0,10);
  const agendaDateInput = document.getElementById('agendaData');
  if (!agendaDateInput.value) agendaDateInput.value = isoHoje;
  const formDataInput = document.getElementById('data');
  if (!formDataInput.value) formDataInput.value = isoHoje;

  carregarAgenda();
});