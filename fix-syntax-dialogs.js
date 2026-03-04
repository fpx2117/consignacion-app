const fs = require('fs');
const path = require('path');

const file1 = path.join(__dirname, 'src', 'app', '(system-guard)', '(protected)', 'productos', 'components', 'create-producto-dialog.tsx');
let c1 = fs.readFileSync(file1, 'utf8');

c1 = c1.replace(`imp              <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Select value={categoriaId} onValueChange={setCategoriaId}>
                      <SelectTrigger className="pl-9 h-11 bg-muted/30">
                        <SelectValue placeholder="Seleccionar categoría..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((cat) => {
                          const catColor = getCategoryColorByKey(cat.color);
                          return (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              <span className="flex items-center gap-2">
                                <span className={cn("h-2 w-2 rounded-full shrink-0", catColor.dot)} />
                                {cat.nombre}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <CreateCategoriaDialog
                    onCreated={() => {
                      apiService.getCategorias().then((data) => {
                        setCategorias(Array.isArray(data) ? data : []);
                      });
                    }}
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        title="Administrar Categorías"
                        className="h-11 px-3 border-dashed border-primary/40 text-primary hover:bg-primary/5"
                      >
                        <Layers className="h-4 w-4" />
                      </Button>
                    }
                  />
                </div>              {!isCreandoNuevaCat && !isEditandoCat ? (`, `              <div className="flex gap-2">`);


c1 = c1.replace(`              <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Select value={categoriaId} onValueChange={setCategoriaId}>
                      <SelectTrigger className="pl-9 h-11 bg-muted/30">
                        <SelectValue placeholder="Seleccionar categoría..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((cat) => {
                          const catColor = getCategoryColorByKey(cat.color);
                          return (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              <span className="flex items-center gap-2">
                                <span className={cn("h-2 w-2 rounded-full shrink-0", catColor.dot)} />
                                {cat.nombre}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  {categoriaId && (
                    <Button
                      type="button"
                      variant="outline"
                      title="Editar categoría seleccionada"
                      className="h-11 px-3 border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5"
                      onClick={() => {
                        const cat = categorias.find(c => c.id.toString() === categoriaId);
                        if (cat) {
                          setEditCatId(cat.id);
                          setEditCatNombre(cat.nombre);
                          setEditCatColor((cat.color || "sky") as CategoryColorKey);
                          setEditCatDescuentos(Array.isArray((cat as any).descuentos) ? (cat as any).descuentos : []);
                          setIsEditandoCat(true);
                        }
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    title="Crear nueva categoría"
                    className="h-11 px-3 border-dashed border-primary/40 text-primary hover:bg-primary/5"
                    onClick={() => { setIsCreandoNuevaCat(true); setCategoriaId(""); setNuevaCatColor("sky"); }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>`, `                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Select value={categoriaId} onValueChange={setCategoriaId}>
                      <SelectTrigger className="pl-9 h-11 bg-muted/30">
                        <SelectValue placeholder="Seleccionar categoría..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((cat) => {
                          const catColor = getCategoryColorByKey(cat.color);
                          return (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              <span className="flex items-center gap-2">
                                <span className={cn("h-2 w-2 rounded-full shrink-0", catColor.dot)} />
                                {cat.nombre}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <CreateCategoriaDialog
                    onCreated={() => {
                      apiService.getCategorias().then((data) => {
                        setCategorias(Array.isArray(data) ? data : []);
                      });
                    }}
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        title="Administrar Categorías"
                        className="h-11 px-3 border-dashed border-primary/40 text-primary hover:bg-primary/5"
                      >
                        <Layers className="h-4 w-4" />
                      </Button>
                    }
                  />
                </div>`);

fs.writeFileSync(file1, c1);
console.log("Create dialog fixed");
