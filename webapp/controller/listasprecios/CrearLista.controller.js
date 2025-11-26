sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    const BASE_URL = window.BASE_URL || 'http://localhost:3033/api';

    return Controller.extend("com.invertions.sapfiorimodinv.controller.listasprecios.CrearLista", {

        onInit: function () {
            const oUser = this.getOwnerComponent().getModel("appView").getProperty("/currentUser");
            
            const oWizardModel = new JSONModel({
                DESLISTA: "",
                IDINSTITUTOOK: "",
                IDTIPOLISTAOK: "",
                IDTIPOGENERALISTAOK: "ESPECIFICA",
                IDTIPOFORMULAOK: "FIJO",
                FECHAEXPIRAINI: this._formatDateForInput(new Date()),
                FECHAEXPIRAFIN: this._formatDateForInput(new Date(new Date().setFullYear(new Date().getFullYear() + 1))),
                RANGO_PRECIOS: "",
                REGUSER: oUser?.USERNAME || "SYSTEM",
                selectedProducts: [],
                selectedProductsCount: 0,
                filteredProducts: [],
                selectedProductsInPile: [],
                availableProductsInList: [],
                allProducts: [],
                availableMarcas: [],
                allCategories: [],
                filteredMarcas: [],
                filteredCategories: [],
                selectedMarcas: [],
                selectedCategories: [],
                searchMarcas: "",
                searchCategorias: "",
                searchTerm: "",
                activeFilterCount: 0,
                currentStep: 1,
                canProceed: false,
                loading: false,
                isEditing: false,
                editingListaId: null,
                itemsPerPage: 5,
                currentPage: 1,
                totalPages: 1,
                paginatedProducts: []  // 🆕 Productos paginados
            });
            
            this.getView().setModel(oWizardModel, "wizardModel");
            
            // Cargar productos
            this._loadProducts();
            
            // Detectar ruta para saber si es crear o editar
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteCrearLista").attachPatternMatched(this._onCrearListaRoute, this);
            oRouter.getRoute("RouteEditarLista").attachPatternMatched(this._onEditarListaRoute, this);
        },
        
        _onCrearListaRoute: function () {
            console.log("📝 Navegando a CREAR LISTA");
            const oModel = this.getView().getModel("wizardModel");
            oModel.setProperty("/isEditing", false);
            oModel.setProperty("/editingListaId", null);
            // Reset del formulario
            oModel.setProperty("/DESLISTA", "");
            oModel.setProperty("/IDINSTITUTOOK", "");
            oModel.setProperty("/IDTIPOLISTAOK", "");
            oModel.setProperty("/selectedProducts", []);
            oModel.setProperty("/selectedProductsCount", 0);
            oModel.setProperty("/currentStep", 1);
        },
        
        _onEditarListaRoute: function (oEvent) {
            console.log("✏️ Navegando a EDITAR LISTA");
            const oArgs = oEvent.getParameter("arguments");
            const sListaId = oArgs?.listaId;
            
            if (sListaId) {
                const oModel = this.getView().getModel("wizardModel");
                oModel.setProperty("/isEditing", true);
                oModel.setProperty("/editingListaId", sListaId);
                this._loadListaForEditing(sListaId);
            }
        },
        
        _loadListaForEditing: async function (sListaId) {
            try {
                console.log("📦 Cargando lista para editar:", sListaId);
                const aListas = await this._callApi('/ztprecios-listas/preciosListasCRUD', 'POST', {}, { ProcessType: 'GetAll' });
                
                const oLista = aListas.find(l => l.IDLISTAOK === sListaId);
                if (!oLista) {
                    MessageBox.error("No se encontró la lista seleccionada.");
                    return;
                }
                
                const oModel = this.getView().getModel("wizardModel");
                oModel.setProperty("/DESLISTA", oLista.DESLISTA || "");
                oModel.setProperty("/IDINSTITUTOOK", oLista.IDINSTITUTOOK || "");
                oModel.setProperty("/IDTIPOLISTAOK", oLista.IDTIPOLISTAOK || "");
                oModel.setProperty("/IDTIPOGENERALISTAOK", oLista.IDTIPOGENERALISTAOK || "ESPECIFICA");
                oModel.setProperty("/IDTIPOFORMULAOK", oLista.IDTIPOFORMULAOK || "FIJO");
                oModel.setProperty("/FECHAEXPIRAINI", this._formatDateForInput(new Date(oLista.FECHAEXPIRAINI)));
                oModel.setProperty("/FECHAEXPIRAFIN", this._formatDateForInput(new Date(oLista.FECHAEXPIRAFIN)));
                
                // Marcar los SKUs que están en la lista
                if (oLista.SKUSIDS && Array.isArray(oLista.SKUSIDS)) {
                    const aAllProducts = oModel.getProperty("/allProducts") || [];
                    const aSelectedProducts = aAllProducts.filter(p => oLista.SKUSIDS.includes(p.SKUID));
                    oModel.setProperty("/selectedProducts", aSelectedProducts);
                    oModel.setProperty("/selectedProductsCount", aSelectedProducts.length);
                }
                
                oModel.setProperty("/currentStep", 1);
                MessageToast.show("Datos cargados para edición");
                
            } catch (error) {
                console.error("❌ Error al cargar lista para editar:", error);
                MessageBox.error("Error al cargar la lista: " + error.message);
            }
        },

        onNavBack: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteListasPrecios", {}, true);
        },

        _loadProducts: async function () {
            const oModel = this.getView().getModel("wizardModel");
            oModel.setProperty("/loading", true);
            
            try {
                console.log("🚀 Iniciando carga de productos...");
                console.log("🔗 BASE_URL:", BASE_URL);
                
                const response = await this._callApi('/ztproducts/crudProducts', 'POST', {}, { 
                    ProcessType: 'GetAll' 
                });
                
                console.log("📦 Respuesta recibida (tipo):", typeof response);
                console.log("📦 Respuesta recibida (es array?):", Array.isArray(response));
                console.log("📦 Respuesta completa:", response);
                
                // La respuesta puede venir en diferentes estructuras
                let aProducts = [];
                
                if (Array.isArray(response)) {
                    aProducts = response;
                    console.log("✅ Caso 1: Respuesta es array directo");
                } else if (response?.data?.[0]?.dataRes) {
                    aProducts = Array.isArray(response.data[0].dataRes) ? response.data[0].dataRes : [response.data[0].dataRes];
                    console.log("✅ Caso 2: data[0].dataRes");
                } else if (response?.dataRes) {
                    aProducts = Array.isArray(response.dataRes) ? response.dataRes : [response.dataRes];
                    console.log("✅ Caso 3: dataRes directo");
                } else if (response && typeof response === 'object') {
                    // Si es un objeto único, convertir a array
                    aProducts = [response];
                    console.log("✅ Caso 4: Objeto único convertido a array");
                }
                
                console.log("📊 Total productos extraídos:", aProducts.length);
                console.log("📊 Primer producto:", aProducts[0]);
                
                if (!Array.isArray(aProducts) || aProducts.length === 0) {
                    console.warn("⚠️ No se encontraron productos");
                    MessageBox.warning("No se encontraron productos en el sistema");
                    aProducts = [];
                }
                
                // 🔧 INICIALIZAR LA PROPIEDAD _selected EN CADA PRODUCTO
                aProducts.forEach(product => {
                    if (product._selected === undefined) {
                        product._selected = false;
                    }
                });
                console.log("✅ Inicializadas propiedades _selected en productos");
                
                oModel.setProperty("/allProducts", aProducts);
                oModel.setProperty("/filteredProducts", aProducts);
                console.log("✅ Productos guardados en modelo");
                
                // Extraer marcas únicas
                const oMarcasSet = new Set();
                aProducts.forEach(p => {
                    if (p.MARCA) {
                        oMarcasSet.add(p.MARCA);
                    }
                });
                const aMarcas = Array.from(oMarcasSet).map(marca => ({ name: marca, selected: false }));
                oModel.setProperty("/availableMarcas", aMarcas);
                oModel.setProperty("/filteredMarcas", aMarcas);
                console.log("🏷️ Marcas encontradas:", aMarcas.length, aMarcas);
                
                // Extraer categorías únicas
                const oCategorias = new Set();
                aProducts.forEach(p => {
                    if (Array.isArray(p.CATEGORIAS)) {
                        p.CATEGORIAS.forEach(cat => oCategorias.add(cat));
                    }
                });
                const aCategories = Array.from(oCategorias).map(cat => ({ name: cat, selected: false }));
                oModel.setProperty("/allCategories", aCategories);
                oModel.setProperty("/filteredCategories", aCategories);
                console.log("📂 Categorías encontradas:", aCategories.length, aCategories);
                
                // 🔧 APLICAR FILTROS INICIALMENTE PARA LLENAR LAS PILAS
                this._applyFilters();
                console.log("✅ Filtros iniciales aplicados, pilas creadas");
                
                if (aProducts.length > 0) {
                    MessageToast.show(`${aProducts.length} productos cargados correctamente`);
                }
                
            } catch (error) {
                console.error("❌ Error completo al cargar productos:", error);
                console.error("❌ Stack:", error.stack);
                MessageBox.error("Error al cargar productos: " + error.message);
                // Establecer arrays vacíos en caso de error
                oModel.setProperty("/allProducts", []);
                oModel.setProperty("/filteredProducts", []);
                oModel.setProperty("/availableMarcas", []);
                oModel.setProperty("/allCategories", []);
            } finally {
                oModel.setProperty("/loading", false);
                console.log("🏁 Carga de productos finalizada");
            }
        },

        _callApi: async function (sRelativeUrl, sMethod, oData = null, oParams = {}) {
            console.log("🌐 _callApi iniciado");
            console.log("📍 URL relativa:", sRelativeUrl);
            console.log("📋 Parámetros:", oParams);
            
            const dbServer = sessionStorage.getItem('DBServer');
            if (dbServer === 'CosmosDB') {
                oParams.DBServer = 'CosmosDB';
            }
            console.log("🗄️ DBServer:", oParams.DBServer || 'MongoDB (default)');

            const oAppViewModel = this.getOwnerComponent().getModel("appView");
            const loggedUser = oAppViewModel.getProperty("/currentUser/USERNAME") || sessionStorage.getItem('LoggedUser');
            
            if (loggedUser && !oParams.LoggedUser) {
                oParams.LoggedUser = loggedUser;
            }
            console.log("👤 LoggedUser:", oParams.LoggedUser);

            const sQueryString = new URLSearchParams(oParams).toString();
            const sFullUrl = `${BASE_URL}${sRelativeUrl}?${sQueryString}`;
            
            console.log("🔗 URL completa:", sFullUrl);
            
            try {
                console.log("📤 Enviando request...");
                const oResponse = await fetch(sFullUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(oData || {})
                });

                console.log("📥 Response status:", oResponse.status);
                console.log("📥 Response ok:", oResponse.ok);
                
                const sResponseText = await oResponse.text();
                console.log("📥 Response raw (primeros 1000 chars):", sResponseText.substring(0, 1000));

                if (!oResponse.ok) {
                    console.error("❌ Request failed with status:", oResponse.status);
                    try {
                        const oErrorJson = JSON.parse(sResponseText);
                        throw new Error(oErrorJson.message || oErrorJson.error || `Error ${oResponse.status}`);
                    } catch (parseError) {
                        throw new Error(`Error ${oResponse.status}: ${sResponseText}`);
                    }
                }

                const oJson = JSON.parse(sResponseText);
                console.log("📋 JSON parseado, keys:", Object.keys(oJson));
                console.log("📋 Estructura completa:", oJson);
                
                // Intentar extraer datos de múltiples estructuras posibles
                // Estructura 1: { value: [{ data: [{ dataRes: [...] }] }] }
                if (oJson && oJson.value && Array.isArray(oJson.value) && oJson.value.length > 0) {
                    console.log("🔍 Explorando value[0]...");
                    const mainResponse = oJson.value[0];
                    console.log("📦 mainResponse keys:", Object.keys(mainResponse));
                    
                    if (mainResponse.data && Array.isArray(mainResponse.data) && mainResponse.data.length > 0) {
                        console.log("🔍 Explorando data[0]...");
                        const dataResponse = mainResponse.data[0];
                        console.log("📦 dataResponse keys:", Object.keys(dataResponse));
                        
                        if (dataResponse.dataRes) {
                            if (Array.isArray(dataResponse.dataRes)) {
                                console.log("✅ Extrayendo de value[0].data[0].dataRes (array):", dataResponse.dataRes.length);
                                return dataResponse.dataRes;
                            } else {
                                console.log("✅ Extrayendo de value[0].data[0].dataRes (objeto)");
                                return [dataResponse.dataRes];
                            }
                        }
                    }
                }
                
                // Estructura 2: { data: [{ dataRes: [...] }] }
                if (oJson && oJson.data && Array.isArray(oJson.data) && oJson.data.length > 0) {
                    console.log("🔍 Explorando data[0]...");
                    const dataResponse = oJson.data[0];
                    if (dataResponse.dataRes) {
                        if (Array.isArray(dataResponse.dataRes)) {
                            console.log("✅ Extrayendo de data[0].dataRes (array):", dataResponse.dataRes.length);
                            return dataResponse.dataRes;
                        } else {
                            console.log("✅ Extrayendo de data[0].dataRes (objeto)");
                            return [dataResponse.dataRes];
                        }
                    }
                }
                
                // Estructura 3: { dataRes: [...] }
                if (oJson && oJson.dataRes) {
                    if (Array.isArray(oJson.dataRes)) {
                        console.log("✅ Extrayendo de dataRes (array):", oJson.dataRes.length);
                        return oJson.dataRes;
                    } else {
                        console.log("✅ Extrayendo de dataRes (objeto)");
                        return [oJson.dataRes];
                    }
                }
                
                // Estructura 4: Respuesta es array directamente
                if (Array.isArray(oJson)) {
                    console.log("✅ Respuesta es array directo:", oJson.length);
                    return oJson;
                }
                
                console.warn("⚠️ Estructura de respuesta no reconocida, devolviendo JSON completo");
                return oJson;
                
            } catch (error) {
                console.error("❌ Error en _callApi:", error);
                console.error("❌ Error stack:", error.stack);
                throw new Error(`Error al procesar la solicitud: ${error.message || error}`);
            }
        },

        onValidateStep1: function () {
            const oModel = this.getView().getModel("wizardModel");
            const sDESLISTA = oModel.getProperty("/DESLISTA");
            const sINSTITUTO = oModel.getProperty("/IDINSTITUTOOK");
            const sFechaIni = oModel.getProperty("/FECHAEXPIRAINI");
            const sFechaFin = oModel.getProperty("/FECHAEXPIRAFIN");
            
            const bValid = sDESLISTA && sINSTITUTO && sFechaIni && sFechaFin;
            oModel.setProperty("/canProceed", bValid);
        },

        onTipoGeneralChange: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            oModel.setProperty("/IDTIPOGENERALISTAOK", oEvent.getParameter("selectedItem").getKey());
        },

        onTipoFormulaChange: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            oModel.setProperty("/IDTIPOFORMULAOK", oEvent.getParameter("selectedItem").getKey());
        },

        onMarcasChange: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const oSource = oEvent.getSource();
            const aSelectedKeys = oSource.getSelectedKeys() || [];
            
            console.log("✅ Evento onMarcasChange");
            console.log("  Marcas seleccionadas:", aSelectedKeys);
            console.log("  Total marcas:", aSelectedKeys.length);
            
            oModel.setProperty("/selectedMarcas", aSelectedKeys);
            this._applyFilters();
        },

        onSearchMarcasChange: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const sSearchTerm = oEvent.getParameter("newValue") || "";
            oModel.setProperty("/searchMarcas", sSearchTerm);
            this._filterMarcas();
        },

        onToggleMarca: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("wizardModel");
            if (!oContext) return;
            
            const oMarca = oContext.getObject();
            const bSelected = oSource.getSelected();
            
            oMarca.selected = bSelected;
            oContext.getModel().refresh(true);
            
            // Actualizar selectedMarcas
            const aSelectedMarcas = oModel.getProperty("/selectedMarcas") || [];
            if (bSelected && !aSelectedMarcas.includes(oMarca.name)) {
                aSelectedMarcas.push(oMarca.name);
            } else if (!bSelected) {
                const iIndex = aSelectedMarcas.indexOf(oMarca.name);
                if (iIndex > -1) {
                    aSelectedMarcas.splice(iIndex, 1);
                }
            }
            
            oModel.setProperty("/selectedMarcas", aSelectedMarcas);
            this._applyFilters();
        },

        onRemoveMarca: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("wizardModel");
            if (!oContext) return;
            
            const sMarcaName = oContext.getObject();
            console.log("❌ Removiendo marca:", sMarcaName);
            
            const aSelectedMarcas = oModel.getProperty("/selectedMarcas") || [];
            const iIndex = aSelectedMarcas.indexOf(sMarcaName);
            
            if (iIndex > -1) {
                aSelectedMarcas.splice(iIndex, 1);
                console.log("✅ Marca removida. Marcas restantes:", aSelectedMarcas);
                oModel.setProperty("/selectedMarcas", aSelectedMarcas);
                
                // Actualizar el MultiComboBox
                const oComboMarcas = this.byId("comboMarcas");
                if (oComboMarcas) {
                    oComboMarcas.setSelectedKeys(aSelectedMarcas);
                }
                
                this._applyFilters();
            }
        },

        _filterMarcas: function () {
            const oModel = this.getView().getModel("wizardModel");
            const aAllMarcas = oModel.getProperty("/availableMarcas") || [];
            const sSearchTerm = (oModel.getProperty("/searchMarcas") || "").toLowerCase();
            
            const aFiltered = aAllMarcas.filter(marca => 
                marca.name.toLowerCase().includes(sSearchTerm)
            );
            
            oModel.setProperty("/filteredMarcas", aFiltered);
        },

        onCategoriasChange: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const oSource = oEvent.getSource();
            const aSelectedKeys = oSource.getSelectedKeys() || [];
            
            console.log("✅ Evento onCategoriasChange");
            console.log("  Categorías seleccionadas:", aSelectedKeys);
            console.log("  Total categorías:", aSelectedKeys.length);
            
            oModel.setProperty("/selectedCategories", aSelectedKeys);
            this._applyFilters();
        },

        onSearchCategoriasChange: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const sSearchTerm = oEvent.getParameter("newValue") || "";
            oModel.setProperty("/searchCategorias", sSearchTerm);
            this._filterCategorias();
        },

        onToggleCategoria: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("wizardModel");
            if (!oContext) return;
            
            const oCategoria = oContext.getObject();
            const bSelected = oSource.getSelected();
            
            oCategoria.selected = bSelected;
            oContext.getModel().refresh(true);
            
            // Actualizar selectedCategories
            const aSelectedCategories = oModel.getProperty("/selectedCategories") || [];
            if (bSelected && !aSelectedCategories.includes(oCategoria.name)) {
                aSelectedCategories.push(oCategoria.name);
            } else if (!bSelected) {
                const iIndex = aSelectedCategories.indexOf(oCategoria.name);
                if (iIndex > -1) {
                    aSelectedCategories.splice(iIndex, 1);
                }
            }
            
            oModel.setProperty("/selectedCategories", aSelectedCategories);
            this._applyFilters();
        },

        onRemoveCategoria: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("wizardModel");
            if (!oContext) return;
            
            const sCategoriaName = oContext.getObject();
            console.log("❌ Removiendo categoría:", sCategoriaName);
            
            const aSelectedCategories = oModel.getProperty("/selectedCategories") || [];
            const iIndex = aSelectedCategories.indexOf(sCategoriaName);
            
            if (iIndex > -1) {
                aSelectedCategories.splice(iIndex, 1);
                console.log("✅ Categoría removida. Categorías restantes:", aSelectedCategories);
                oModel.setProperty("/selectedCategories", aSelectedCategories);
                
                // Actualizar el MultiComboBox
                const oComboCategorias = this.byId("comboCategorias");
                if (oComboCategorias) {
                    oComboCategorias.setSelectedKeys(aSelectedCategories);
                }
                
                this._applyFilters();
            }
        },

        _filterCategorias: function () {
            const oModel = this.getView().getModel("wizardModel");
            const aAllCategories = oModel.getProperty("/allCategories") || [];
            const sSearchTerm = (oModel.getProperty("/searchCategorias") || "").toLowerCase();
            
            const aFiltered = aAllCategories.filter(categoria => 
                categoria.name.toLowerCase().includes(sSearchTerm)
            );
            
            oModel.setProperty("/filteredCategories", aFiltered);
        },

        onRangoPreciosChange: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const sKey = oEvent.getParameter("selectedItem").getKey();
            oModel.setProperty("/RANGO_PRECIOS", sKey);
            console.log("Rango de precio seleccionado:", sKey);
            this._applyFilters();
        },

        onSearchProduct: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue") || oEvent.getParameter("value") || "";
            oModel.setProperty("/searchTerm", sQuery);
            console.log("Búsqueda:", sQuery);
            this._applyFilters();
        },

        onClearFilters: function () {
            const oModel = this.getView().getModel("wizardModel");
            oModel.setProperty("/selectedMarcas", []);
            oModel.setProperty("/selectedCategories", []);
            oModel.setProperty("/RANGO_PRECIOS", "");
            oModel.setProperty("/searchTerm", "");
            
            // Limpiar los controles visuales
            const oComboMarcas = this.byId("comboMarcas");
            const oComboCategorias = this.byId("comboCategorias");
            const oSelectRango = this.byId("selectRangoPrecio");
            const oSearchField = this.byId("searchProducto");
            
            if (oComboMarcas) {
                oComboMarcas.setSelectedKeys([]);
            }
            if (oComboCategorias) {
                oComboCategorias.setSelectedKeys([]);
            }
            if (oSelectRango) {
                oSelectRango.setSelectedKey("");
            }
            if (oSearchField) {
                oSearchField.setValue("");
            }
            
            console.log("Filtros limpiados");
            this._applyFilters();
        },

        _applyFilters: function () {
            const oModel = this.getView().getModel("wizardModel");
            const aAllProducts = oModel.getProperty("/allProducts") || [];
            const aSelectedMarcas = oModel.getProperty("/selectedMarcas") || [];
            const aSelectedCategories = oModel.getProperty("/selectedCategories") || [];
            const sSearchTerm = (oModel.getProperty("/searchTerm") || "").toLowerCase();
            const sRangoPrecio = oModel.getProperty("/RANGO_PRECIOS");
            
            console.log("🔄 ===== APLICANDO FILTROS =====");
            console.log("📊 Total productos en allProducts:", aAllProducts.length);
            console.log("🏷️  Marcas seleccionadas:", aSelectedMarcas);
            console.log("📂 Categorías seleccionadas:", aSelectedCategories);
            console.log("🔍 Término de búsqueda:", sSearchTerm || "(vacío)");
            console.log("💰 Rango de precio:", sRangoPrecio || "(vacío)");
            
            // 🔧 SEPARAR PRODUCTOS EN DOS ARRAYS
            const aSelectedProductsInPile = [];
            const aAvailableProducts = [];
            
            aAllProducts.forEach(product => {
                if (product._selected === true) {
                    // Si está seleccionado, va a la pila (siempre visible)
                    aSelectedProductsInPile.push(product);
                } else {
                    // Si no está seleccionado, aplicar filtros normales
                    let bPassAllFilters = true;
                    
                    // Filtro por marcas
                    if (aSelectedMarcas.length > 0) {
                        const bMatchMarca = aSelectedMarcas.includes(product.MARCA);
                        if (!bMatchMarca) {
                            bPassAllFilters = false;
                        }
                    }
                    
                    // Filtro por categorías
                    if (aSelectedCategories.length > 0 && bPassAllFilters) {
                        const bHasCategory = Array.isArray(product.CATEGORIAS) && 
                            product.CATEGORIAS.some(cat => aSelectedCategories.includes(cat));
                        if (!bHasCategory) {
                            bPassAllFilters = false;
                        }
                    }
                    
                    // Filtro por búsqueda
                    if (sSearchTerm && bPassAllFilters) {
                        const bMatchSKU = product.SKUID && product.SKUID.toLowerCase().includes(sSearchTerm);
                        const bMatchName = product.PRODUCTNAME && product.PRODUCTNAME.toLowerCase().includes(sSearchTerm);
                        const bMatchMarca = product.MARCA && product.MARCA.toLowerCase().includes(sSearchTerm);
                        
                        if (!bMatchSKU && !bMatchName && !bMatchMarca) {
                            bPassAllFilters = false;
                        }
                    }
                    
                    // Filtro por rango de precio
                    if (bPassAllFilters) {
                        aAvailableProducts.push(product);
                    }
                }
            });
            
            console.log("📍 Productos en pila (seleccionados):", aSelectedProductsInPile.length);
            console.log("📍 Productos disponibles (filtrados):", aAvailableProducts.length);
            console.log("🔄 ===== FIN FILTROS =====");
            
            // Actualizar el modelo con ambos arrays
            oModel.setProperty("/selectedProductsInPile", aSelectedProductsInPile);
            oModel.setProperty("/availableProductsInList", aAvailableProducts);
            
            // Para compatibilidad con bindings antiguos, concatenar ambos arrays
            const aFilteredProducts = [...aSelectedProductsInPile, ...aAvailableProducts];
            oModel.setProperty("/filteredProducts", aFilteredProducts);
            
            // 🔧 APLICAR PAGINACIÓN A LOS PRODUCTOS DISPONIBLES
            oModel.setProperty("/currentPage", 1);
            this._updatePaginatedProducts();
            
            // Contar filtros activos
            let iActiveFilters = 0;
            if (aSelectedMarcas.length > 0) iActiveFilters++;
            if (aSelectedCategories.length > 0) iActiveFilters++;
            if (sSearchTerm) iActiveFilters++;
            if (sRangoPrecio) iActiveFilters++;
            
            oModel.setProperty("/activeFilterCount", iActiveFilters);
            
            console.log(`📱 Toast: ${aFilteredProducts.length} productos encontrados`);
            MessageToast.show(`${aFilteredProducts.length} productos encontrados`);
        },
        
        _updatePaginatedProducts: function () {
            const oModel = this.getView().getModel("wizardModel");
            const aAvailableProducts = oModel.getProperty("/availableProductsInList") || [];
            const iItemsPerPage = oModel.getProperty("/itemsPerPage");
            const iCurrentPage = oModel.getProperty("/currentPage");
            
            // Calcular índices
            const iStartIndex = (iCurrentPage - 1) * iItemsPerPage;
            const iEndIndex = iStartIndex + iItemsPerPage;
            
            // Obtener productos paginados
            const aPaginatedProducts = aAvailableProducts.slice(iStartIndex, iEndIndex);
            
            // Calcular total de páginas
            const iTotalPages = Math.ceil(aAvailableProducts.length / iItemsPerPage) || 1;
            
            console.log(`📄 Paginación: Página ${iCurrentPage} de ${iTotalPages}, mostrando ${aPaginatedProducts.length} items`);
            
            oModel.setProperty("/paginatedProducts", aPaginatedProducts);
            oModel.setProperty("/totalPages", iTotalPages);
        },
        
        onNextPage: function () {
            const oModel = this.getView().getModel("wizardModel");
            const iCurrentPage = oModel.getProperty("/currentPage");
            const iTotalPages = oModel.getProperty("/totalPages");
            
            if (iCurrentPage < iTotalPages) {
                oModel.setProperty("/currentPage", iCurrentPage + 1);
                this._updatePaginatedProducts();
                console.log("➡️ Página siguiente");
            }
        },
        
        onPreviousPage: function () {
            const oModel = this.getView().getModel("wizardModel");
            const iCurrentPage = oModel.getProperty("/currentPage");
            
            if (iCurrentPage > 1) {
                oModel.setProperty("/currentPage", iCurrentPage - 1);
                this._updatePaginatedProducts();
                console.log("⬅️ Página anterior");
            }
        },

        onProductSelect: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const oSource = oEvent.getSource();
            
            // Obtener el contexto del binding del checkbox
            const oContext = oSource.getBindingContext("wizardModel");
            if (!oContext) {
                console.warn("⚠️ No hay contexto de binding");
                return;
            }
            
            const oProduct = oContext.getObject();
            const bSelected = oSource.getSelected();
            
            console.log(`🔘 Producto Select Event: ${oProduct.SKUID} - ${oProduct.PRODUCTNAME}`);
            console.log(`  Seleccionado: ${bSelected}`);
            
            // Marcar/desmarcar el producto en el modelo
            oProduct._selected = bSelected;
            oContext.getModel().refresh(true);
            
            // Recalcular el contador de productos seleccionados
            const aAllProducts = oModel.getProperty("/allProducts") || [];
            const aSelectedProducts = aAllProducts.filter(p => p._selected === true);
            
            console.log(`  Total seleccionados ahora: ${aSelectedProducts.length}`);
            
            oModel.setProperty("/selectedProducts", aSelectedProducts);
            oModel.setProperty("/selectedProductsCount", aSelectedProducts.length);
            oModel.setProperty("/canProceed", aSelectedProducts.length > 0);
            
            // 🔧 REAPLICAR FILTROS PARA ACTUALIZAR LAS PILAS
            this._applyFilters();
            console.log("✅ Pilas reaplicadas después de cambio de selección");
        },

        onSelectAllProducts: function (oEvent) {
            const oModel = this.getView().getModel("wizardModel");
            const oCheckbox = oEvent.getSource();
            const bSelected = oCheckbox.getSelected();
            
            console.log(`✅ Seleccionar todos: ${bSelected ? "SÍ" : "NO"}`);
            
            // Obtener los productos disponibles actualmente mostrados
            const aAvailableProducts = oModel.getProperty("/availableProductsInList") || [];
            
            // Marcar/desmarcar todos los productos disponibles
            aAvailableProducts.forEach(product => {
                product._selected = bSelected;
            });
            
            // Obtener todos los productos
            const aAllProducts = oModel.getProperty("/allProducts") || [];
            
            // Recalcular el contador de productos seleccionados (desde allProducts)
            const aSelectedProducts = aAllProducts.filter(p => p._selected === true);
            
            console.log(`  Total seleccionados ahora: ${aSelectedProducts.length}`);
            
            oModel.setProperty("/selectedProducts", aSelectedProducts);
            oModel.setProperty("/selectedProductsCount", aSelectedProducts.length);
            oModel.setProperty("/canProceed", aSelectedProducts.length > 0);
            
            // Refrescar filtros para actualizar pilas
            this._applyFilters();
            
            console.log("🔄 Filtros reaplicados después de 'Seleccionar todos'");
        },

        onWizardNext: function () {
            const oWizard = this.byId("wizardCrearLista");
            const oModel = this.getView().getModel("wizardModel");
            const iCurrentStep = oModel.getProperty("/currentStep");
            
            if (iCurrentStep === 2) {
                // Paso 2 es el último - Guardar
                this._saveLista();
            } else {
                // Paso 1 - pasar al paso 2
                oWizard.nextStep();
                oModel.setProperty("/currentStep", 2);
            }
        },

        onWizardBack: function () {
            const oWizard = this.byId("wizardCrearLista");
            const oModel = this.getView().getModel("wizardModel");
            const iCurrentStep = oModel.getProperty("/currentStep");
            
            oWizard.previousStep();
            oModel.setProperty("/currentStep", iCurrentStep - 1);
            oModel.setProperty("/canProceed", true);
        },

        onWizardComplete: function () {
            this._saveLista();
        },

        _saveLista: async function () {
            const oModel = this.getView().getModel("wizardModel");
            const bIsEditing = oModel.getProperty("/isEditing");
            
            const aSelectedProducts = oModel.getProperty("/selectedProducts") || [];
            const aSKUIDs = aSelectedProducts.map(p => p.SKUID);
            
            if (aSKUIDs.length === 0) {
                MessageBox.error("Debes seleccionar al menos un producto.");
                return;
            }
            
            const sDESLISTA = oModel.getProperty("/DESLISTA");
            const sINSTITUTO = oModel.getProperty("/IDINSTITUTOOK");
            
            if (!sDESLISTA || !sINSTITUTO) {
                MessageBox.error("Completa todos los campos obligatorios.");
                return;
            }
            
            oModel.setProperty("/loading", true);
            
            try {
                const sIdListaOK = bIsEditing ? oModel.getProperty("/editingListaId") : `LISTA-${Date.now()}`;
                
                const payload = {
                    IDLISTAOK: sIdListaOK,
                    SKUSIDS: JSON.stringify(aSKUIDs),
                    IDINSTITUTOOK: sINSTITUTO.trim(),
                    IDLISTABK: "",
                    DESLISTA: sDESLISTA.trim(),
                    FECHAEXPIRAINI: oModel.getProperty("/FECHAEXPIRAINI"),
                    FECHAEXPIRAFIN: oModel.getProperty("/FECHAEXPIRAFIN"),
                    IDTIPOLISTAOK: oModel.getProperty("/IDTIPOLISTAOK") || "GENERAL",
                    IDTIPOGENERALISTAOK: oModel.getProperty("/IDTIPOGENERALISTAOK"),
                    IDTIPOFORMULAOK: oModel.getProperty("/IDTIPOFORMULAOK"),
                    REGUSER: oModel.getProperty("/REGUSER"),
                    ACTIVED: true,
                    DELETED: false
                };
                
                const sProcessType = bIsEditing ? 'UpdateOne' : 'AddOne';
                await this._callApi('/ztprecios-listas/preciosListasCRUD', 'POST', payload, {
                    ProcessType: sProcessType
                });
                
                const sMessage = bIsEditing ? "Lista de precios actualizada correctamente" : "Lista de precios creada correctamente";
                MessageToast.show(sMessage);
                
                // Navegar de vuelta a la lista
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteListasPrecios", {}, true);
                
            } catch (error) {
                const sErrorMsg = bIsEditing ? "Error al actualizar la lista: " : "Error al crear la lista: ";
                MessageBox.error(sErrorMsg + error.message);
            } finally {
                oModel.setProperty("/loading", false);
            }
        },

        _formatDateForInput: function (date) {
            if (!date) return '';
            const d = new Date(date);
            const year = d.getUTCFullYear();
            const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
            const day = `${d.getUTCDate()}`.padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    });
});
