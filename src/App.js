import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import './App.css';

const App = () => {
  const [datos, setDatos] = useState([]);
  const [diasDisponibles, setDiasDisponibles] = useState([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState('');
  const [cargando, setCargando] = useState(false);
  const [fechaExcel, setFechaExcel] = useState('');
  const [archivoImportado, setArchivoImportado] = useState(false);
  const [hojas, setHojas] = useState([]);
  const [hojaSeleccionada, setHojaSeleccionada] = useState('');
  const [datosOriginales, setDatosOriginales] = useState(null);
  
  // Configuración fija: 2 columnas x 10 filas = 20 etiquetas por página
  const configuracionEtiquetas = {
    columnas: 2,
    filas: 10,
    anchuraEtiqueta: 50, // 50% para 2 columnas
    alturaEtiqueta: 10   // 10% para 10 filas
  };

  // Función para manejar la carga del archivo Excel
  const cargarExcel = (evento) => {
    const archivo = evento.target.files[0];
    if (archivo) {
      setCargando(true);
      const fileReader = new FileReader();
      fileReader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Guardamos las hojas disponibles
          const hojasDisponibles = workbook.SheetNames;
          setHojas(hojasDisponibles);
          
          // Si hay hojas disponibles, seleccionamos la primera por defecto
          if (hojasDisponibles.length > 0) {
            const primeraHoja = hojasDisponibles[0];
            setHojaSeleccionada(primeraHoja);
            
            // Procesamos la primera hoja
            procesarHoja(workbook, primeraHoja);
          }
          
          // Guardamos el workbook completo para uso posterior
          setDatosOriginales(workbook);
          
          // Intentamos extraer información del nombre del archivo o de las celdas
          if (archivo.name.includes('Almuerzo')) {
            // Extraer fechas del nombre del archivo 
            const matchFecha = archivo.name.match(/(\d+)\s+al\s+(\d+)\s+de\s+(\w+)\s+del\s+(\d+)/i);
            if (matchFecha) {
              setFechaExcel(`Semana del ${matchFecha[1]} al ${matchFecha[2]} de ${matchFecha[3]} de ${matchFecha[4]}`);
            } else {
              setFechaExcel(archivo.name.replace('.xlsx', '').replace('.xls', ''));
            }
          } else {
            setFechaExcel(archivo.name.replace('.xlsx', '').replace('.xls', ''));
          }
          
          setArchivoImportado(true);
          
        } catch (error) {
          console.error("Error al procesar el archivo Excel:", error);
          alert("Error al procesar el archivo. Asegúrese de que es un archivo Excel válido.");
        } finally {
          setCargando(false);
        }
      };
      fileReader.readAsArrayBuffer(archivo);
    }
  };

  // Función para procesar una hoja específica del Excel
  const procesarHoja = (workbook, nombreHoja) => {
    const worksheet = workbook.Sheets[nombreHoja];
    
    // Convertimos los datos a JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Identificamos las filas que contienen información de días
    const diasEncontrados = detectarDias(jsonData);
    setDiasDisponibles(diasEncontrados);
    
    // Si hay días disponibles, seleccionamos el primero por defecto
    if (diasEncontrados.length > 0) {
      setDiaSeleccionado(diasEncontrados[0].valor);
      
      // Filtramos los datos para el día seleccionado
      const datosDia = extraerDatosPorDia(jsonData, diasEncontrados[0]);
      setDatos(datosDia);
    } else {
      // Si no detectamos días, procesamos todos los datos como si fueran de un único día
      const datosFormateados = procesarDatosExcel(jsonData);
      setDatos(datosFormateados);
    }
  };

  // Función para detectar las filas que contienen información de días
  const detectarDias = (jsonData) => {
    const diasSemana = ['lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    const dias = [];
    
    // Recorremos las filas buscando menciones a días o fechas
    jsonData.forEach((fila, indice) => {
      if (!fila || fila.length === 0) return;
      
      // Convertimos la fila a texto para buscar más fácilmente
      const filaTexto = fila.join(' ').toLowerCase();
      
      // Buscamos menciones a días de la semana
      for (const dia of diasSemana) {
        if (filaTexto.includes(dia)) {
          // Intentamos extraer la fecha completa si existe
          let fechaCompleta = filaTexto;
          
          // Buscamos si hay un número de día
          const regexDia = /\b(\d{1,2})\b/;
          const matchDia = filaTexto.match(regexDia);
          
          // Buscamos si se menciona algún mes
          let mesEncontrado = null;
          for (const mes of meses) {
            if (filaTexto.includes(mes)) {
              mesEncontrado = mes;
              break;
            }
          }
          
          // Si tenemos día y mes, construimos una descripción más completa
          if (matchDia && mesEncontrado) {
            fechaCompleta = `${dia} ${matchDia[1]} de ${mesEncontrado}`;
          }
          
          dias.push({
            dia: dia,
            indice: indice,
            valor: fila.join(' '), // Usamos el texto original como valor
            descripcion: fechaCompleta
          });
          break;
        }
      }
    });
    
    return dias;
  };

  // Función para extraer los datos de un día específico
  const extraerDatosPorDia = (jsonData, diaInfo) => {
    // Encontramos el índice del siguiente día (si existe)
    const indiceSiguienteDia = diasDisponibles.findIndex(d => d.indice === diaInfo.indice) + 1;
    const limiteSuperior = indiceSiguienteDia < diasDisponibles.length 
                         ? diasDisponibles[indiceSiguienteDia].indice 
                         : jsonData.length;
    
    // Extraemos los datos entre el día actual y el siguiente (o el final)
    const datosDia = jsonData.slice(diaInfo.indice + 1, limiteSuperior);
    
    // Procesamos estos datos
    return procesarDatosExcel(datosDia);
  };

  // Función principal para procesar los datos del Excel
  const procesarDatosExcel = (jsonData) => {
    // Filtramos filas vacías
    const filasNoVacias = jsonData.filter(fila => 
      fila && fila.length > 0 && fila.some(celda => celda != null && celda !== '')
    );
    
    // Determinamos si es formato tabla o formato simple
    const esFormatoTabla = detectarFormatoTabla(filasNoVacias);
    
    if (esFormatoTabla) {
      return procesarFormatoTabla(filasNoVacias);
    } else {
      return procesarFormatoSimple(filasNoVacias);
    }
  };
  
  // Detectar si los datos están en formato de tabla
  const detectarFormatoTabla = (filas) => {
    if (filas.length < 3) return false;
    
    // Contamos celdas no vacías en cada columna
    let conteoColumnas = [];
    filas.slice(0, Math.min(5, filas.length)).forEach(fila => {
      fila.forEach((celda, indice) => {
        if (!conteoColumnas[indice]) conteoColumnas[indice] = 0;
        if (celda != null && celda !== '') {
          conteoColumnas[indice]++;
        }
      });
    });
    
    // Si hay columnas con datos consistentes, es probable que sea una tabla
    const columnasConDatos = conteoColumnas.filter(c => c >= Math.min(3, filas.length)).length;
    return columnasConDatos >= 2;
  };
  
  // Procesar datos en formato de tabla
  const procesarFormatoTabla = (filas) => {
    const resultado = [];
    
    // Detectamos columnas con contenido consistente
    const anchuraMaxima = Math.max(...filas.map(f => f.length));
    let conteoNoVacias = new Array(anchuraMaxima).fill(0);
    
    filas.forEach(fila => {
      fila.forEach((celda, indice) => {
        if (celda != null && celda !== '') {
          conteoNoVacias[indice]++;
        }
      });
    });
    
    // Identificamos bloques de columnas que forman registros
    const bloques = [];
    let bloqueActual = [];
    
    conteoNoVacias.forEach((conteo, indice) => {
      if (conteo > filas.length * 0.3) {
        bloqueActual.push(indice);
      } else if (bloqueActual.length > 0) {
        bloques.push([...bloqueActual]);
        bloqueActual = [];
      }
    });
    
    if (bloqueActual.length > 0) {
      bloques.push(bloqueActual);
    }
    
    // Para cada fila, extraemos los datos de cada bloque como un registro
    filas.forEach(fila => {
      bloques.forEach(bloque => {
        // Extraemos los valores de las columnas de este bloque
        const valores = bloque.map(indice => 
          indice < fila.length ? fila[indice] : ''
        ).filter(valor => valor != null && valor !== '');
        
        if (valores.length >= 3) { // Necesitamos al menos ID, nombre y algo más
          // El primer valor es el ID, el segundo es nombre, el tercero es departamento, el resto es menú
          const id = valores[0];
          const nombre = valores[1];
          const departamento = valores.length > 2 ? valores[2] : '';
          const menu = valores.slice(3).join('\n');
          
          if (nombre) { // Verificamos que al menos haya un nombre
            resultado.push({
              id: id.toString(),
              nombre: nombre.toString().toUpperCase(),
              departamento: departamento.toString().toUpperCase(),
              menu: menu.toUpperCase()
            });
          }
        }
      });
    });
    
    return resultado;
  };
  
  // Procesar datos en formato simple (fila por fila)
  const procesarFormatoSimple = (filas) => {
    const resultado = [];
    
    filas.forEach(fila => {
      // Filtrar valores no vacíos
      const valores = fila.filter(celda => celda != null && celda !== '');
      
      if (valores.length >= 3) { // Necesitamos al menos ID, nombre y algo más
        // El primer valor es el ID, el segundo es nombre, el tercero es departamento, el resto es menú
        const id = valores[0];
        const nombre = valores[1];
        const departamento = valores.length > 2 ? valores[2] : '';
        const menu = valores.slice(3).join('\n');
        
        if (nombre) { // Verificamos que al menos haya un nombre
          resultado.push({
            id: id.toString(),
            nombre: nombre.toString().toUpperCase(),
            departamento: departamento.toString().toUpperCase(),
            menu: menu.toUpperCase()
          });
        }
      }
    });
    
    return resultado;
  };

  // Función para cambiar la hoja seleccionada
  const cambiarHoja = (e) => {
    const nuevaHoja = e.target.value;
    setHojaSeleccionada(nuevaHoja);
    
    if (datosOriginales) {
      procesarHoja(datosOriginales, nuevaHoja);
    }
  };

  // Función para cambiar el día seleccionado
  const cambiarDia = (e) => {
    const nuevoDia = e.target.value;
    setDiaSeleccionado(nuevoDia);
    
    // Encontramos la información del día seleccionado
    const diaInfo = diasDisponibles.find(d => d.valor === nuevoDia);
    
    if (diaInfo && datosOriginales) {
      const worksheet = datosOriginales.Sheets[hojaSeleccionada];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Extraemos los datos para este día
      const datosDia = extraerDatosPorDia(jsonData, diaInfo);
      setDatos(datosDia);
    }
  };

  // Función para imprimir
  const imprimir = () => {
    window.print();
  };

  // Organizamos los datos en páginas de 2x10
  const organizarEtiquetas = () => {
    const resultado = [];
    const datosCompletos = [...datos];
    const etiquetasPorPagina = configuracionEtiquetas.filas * configuracionEtiquetas.columnas;
    
    // Completamos el array hasta un múltiplo del número de etiquetas por página
    while (datosCompletos.length % etiquetasPorPagina !== 0) {
      datosCompletos.push({ nombre: '', departamento: '', menu: '' });
    }
    
    // Organizamos en páginas
    for (let i = 0; i < datosCompletos.length; i += etiquetasPorPagina) {
      const pagina = [];
      
      for (let fila = 0; fila < configuracionEtiquetas.filas; fila++) {
        const filaActual = [];
        
        for (let columna = 0; columna < configuracionEtiquetas.columnas; columna++) {
          const indice = i + fila * configuracionEtiquetas.columnas + columna;
          filaActual.push(datosCompletos[indice]);
        }
        
        pagina.push(filaActual);
      }
      
      resultado.push(pagina);
    }
    
    return resultado;
  };

  const etiquetasOrganizadas = organizarEtiquetas();

  return (
    <div className="app-container">
      {/* Controles - no se imprimirán */}
      <div className="controls-container no-print">
        <div className="controls-inner">
          <h1 className="app-title">
            Aplicación de Menú Semanal - {fechaExcel || 'Cargue un archivo Excel'}
          </h1>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Cargar archivo Excel:
              </label>
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={cargarExcel}
                className="form-input"
              />
            </div>
          </div>
          
          {archivoImportado && (
            <>
              <div className="form-row">
                {hojas.length > 1 && (
                  <div className="form-group">
                    <label className="form-label">
                      Seleccionar hoja:
                    </label>
                    <select 
                      value={hojaSeleccionada}
                      onChange={cambiarHoja}
                      className="form-select"
                    >
                      {hojas.map((hoja, index) => (
                        <option key={`hoja-${index}`} value={hoja}>
                          {hoja}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {diasDisponibles.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">
                      Seleccionar día:
                    </label>
                    <select 
                      value={diaSeleccionado}
                      onChange={cambiarDia}
                      className="form-select"
                    >
                      {diasDisponibles.map((dia, index) => (
                        <option key={`dia-${index}`} value={dia.valor}>
                          {dia.descripcion || dia.valor}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="form-group">
                  <label className="form-label">
                    &nbsp;
                  </label>
                  <button 
                    onClick={imprimir}
                    className="print-button"
                  >
                    Imprimir Menú
                  </button>
                </div>
              </div>
              
              <div className="info-box">
                <div className="info-title">Formato del Excel</div>
                <p>Para que la aplicación reconozca correctamente los datos:</p>
                <ol>
                  <li>La <strong>primera columna</strong> debe contener el <strong>nombre</strong> de la persona</li>
                  <li>La <strong>segunda columna</strong> debe contener el <strong>departamento</strong></li>
                  <li>Las <strong>columnas restantes</strong> (tercera en adelante) se consideran como el <strong>menú</strong></li>
                </ol>
                <p>Ejemplo: <code>LUIS MEDRANO | SISTEMAS | ARROZ BLANCO | HABICHUELA ROJA GUISADAS</code></p>
              </div>
            </>
          )}
          
          {!archivoImportado && (
            <div className="instruction-text">
              Por favor, cargue un archivo Excel para comenzar.
            </div>
          )}
        </div>
      </div>
      
      {/* Contenido imprimible */}
      <div className="content-container">
        <div className="content-inner">
          {cargando ? (
            <div className="loading-message">
              <p>Cargando datos...</p>
            </div>
          ) : (
            <>
              {archivoImportado && datos.length > 0 ? (
                <>
                  <div className="preview-header no-print">
                    <h2 className="preview-title">
                      Vista previa: {diaSeleccionado || 'Todos los datos'}
                    </h2>
                    <div className="preview-info">
                      Total de etiquetas: {datos.length} 
                      (Se organizarán en {Math.ceil(datos.length / (configuracionEtiquetas.filas * configuracionEtiquetas.columnas))} página(s) de {configuracionEtiquetas.filas * configuracionEtiquetas.columnas} etiquetas)
                    </div>
                    <div className="preview-instruction">
                      Esta es una vista previa del menú. Presione el botón "Imprimir Menú" para imprimir.
                    </div>
                  </div>
                  
                  {/* Versión para pantalla */}
                  <div className="menu-preview no-print">
                    {etiquetasOrganizadas.map((pagina, paginaIndex) => (
                      <div key={`pagina-${paginaIndex}`} className="pagina-preview">
                        <h3 className="pagina-titulo">Página {paginaIndex + 1}</h3>
                        <div className="labels-preview">
                          {pagina.map((fila, filaIndex) => (
                            <div 
                              key={`fila-${paginaIndex}-${filaIndex}`} 
                              className="labels-row"
                              style={{ height: `${configuracionEtiquetas.alturaEtiqueta}%` }}
                            >
                              {fila.map((item, colIndex) => (
                                <div 
                                  key={`celda-${paginaIndex}-${filaIndex}-${colIndex}`} 
                                  className={`label-cell ${!item.nombre ? 'empty' : ''}`}
                                  style={{ width: `${configuracionEtiquetas.anchuraEtiqueta}%` }}
                                >
                                  {item.nombre && (
                                    <>
                                      <div className="label-id">{item.id}</div>
                                      <div className="label-name">{item.nombre}</div>
                                      {item.departamento && (
                                        <div className="label-department">{item.departamento}</div>
                                      )}
                                      <div className="label-menu">{item.menu}</div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Versión para impresión */}
                  <div className="print-only">
                    {etiquetasOrganizadas.map((pagina, paginaIndex) => (
                      <div 
                        key={`print-pagina-${paginaIndex}`} 
                        className="print-grid"
                      >
                        {pagina.map((fila, filaIndex) => (
                          <div 
                            key={`print-fila-${paginaIndex}-${filaIndex}`} 
                            className="print-row"
                            style={{ height: `${configuracionEtiquetas.alturaEtiqueta}%` }}
                          >
                            {fila.map((item, colIndex) => (
                              <div 
                                key={`print-celda-${paginaIndex}-${filaIndex}-${colIndex}`} 
                                className={`print-cell ${!item.nombre ? 'empty' : ''}`}
                                style={{ width: `${configuracionEtiquetas.anchuraEtiqueta}%` }}
                              >
                                {item.nombre && (
                                  <div className="print-cell-content">
                                    <div className="print-id">{item.id}</div>
                                    <div className="print-person">{item.nombre}</div>
                                    {item.departamento && (
                                      <div className="print-department">{item.departamento}</div>
                                    )}
                                    <div className="print-items">{item.menu}</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              ) : archivoImportado ? (
                <div className="no-data-message">
                  <p>No se encontraron datos en el archivo Excel. Por favor, seleccione otra hoja o verifique el formato del archivo.</p>
                </div>
              ) : (
                <div className="no-data-message">
                  <p>Cargue un archivo Excel para ver los datos del menú.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Pie de página */}
      <div className="footer no-print">
        <div className="footer-inner">
          Aplicación de Menú Semanal - Ministerio de Energía y Minas &copy; 2025
        </div>
      </div>
    </div>
  );
};

export default App;