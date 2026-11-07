const settings = window.ROSABEL_CONFIG || {};
const publicKey = settings.supabaseAnonKey || settings.publishableKey || "";
const adminButton = document.getElementById("adminButton");
const adminDialog = document.getElementById("adminDialog");
const loginView = document.getElementById("adminLoginView");
const panelView = document.getElementById("adminPanelView");
const loginForm = document.getElementById("adminLoginForm");
const productForm = document.getElementById("productAdminForm");
const variantRows = document.getElementById("adminVariantRows");
const loginMessage = document.getElementById("adminLoginMessage");
const saveMessage = document.getElementById("productSaveMessage");
const existingMediaList = document.getElementById("existingMediaList");
const adminProducts = document.getElementById("adminProducts");

if (!settings.supabaseUrl || !publicKey) {
  adminButton.hidden = true;
} else {
  adminButton.hidden = false;
  initializeOwnerPanel().catch((error) => {
    console.error("No se pudo iniciar la tienda de Rosabel.", error);
    adminButton.hidden = true;
    loginMessage.textContent = "No pudimos conectar con la tienda. Revisa la configuración e inténtalo otra vez.";
  });
}

async function initializeOwnerPanel() {
  const createClient = window.supabase?.createClient;
  if (!createClient) throw new Error("No se pudo cargar el cliente de Supabase.");
  const supabase = createClient(settings.supabaseUrl, publicKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });

  async function cloudProducts(onlyOwner = false) {
    let request = supabase.from("products").select("*").order("created_at", { ascending: false });
    if (!onlyOwner) request = request.eq("published", true);
    const { data, error } = await request;
    if (error) throw error;
    return (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      price: Number(row.price),
      hours: Number(row.hours),
      artisan: row.artisan || "Rosa Bertha Llontop Lluen",
      origin: row.origin || "Monsefú, Lambayeque",
      technique: row.technique,
      category: row.category,
      description: row.description,
      media: Array.isArray(row.media) ? row.media : [],
      image: (Array.isArray(row.media) ? row.media : []).find((media) => media.type === "image")?.url || "",
      variants: Array.isArray(row.variants) ? row.variants : [],
      published: row.published,
      ownerId: row.owner_id,
      createdAt: row.created_at
    }));
  }

  async function refreshPublicCatalog() {
    try {
      const products = await cloudProducts(false);
      window.rosabelCatalog.setCloudProducts(products);
    } catch (error) {
      console.warn("El catálogo remoto todavía no está preparado.", error);
      loginMessage.textContent = "Falta preparar las tablas de productos en Supabase.";
    }
  }

  function setLoginError(message) {
    loginMessage.textContent = message;
    loginMessage.dataset.kind = "error";
  }

  async function setLoggedIn() {
    const { data, error } = await supabase.rpc("is_rosabel_owner_current");
    if (error) {
      setLoginError("No pudimos validar el acceso. Confirma que la configuración de Rosabel esté completa.");
      loginView.hidden = false;
      panelView.hidden = true;
      return false;
    }
    if (data !== true) {
      setLoginError("Este correo no tiene acceso al panel de Rosa.");
      loginView.hidden = false;
      panelView.hidden = true;
      return false;
    }
    loginMessage.textContent = "";
    loginView.hidden = true;
    panelView.hidden = false;
    return true;
  }

  async function showOwnerProducts() {
    adminProducts.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = "Mis productos publicados";
    adminProducts.append(heading);
    let products;
    try {
      products = await cloudProducts(true);
    } catch (error) {
      const note = document.createElement("p");
      note.className = "privacy-note";
      note.textContent = "No pudimos leer los productos. Confirma que ejecutaste la configuración SQL y autorizaste el correo de Rosa.";
      adminProducts.append(note);
      return;
    }
    if (!products.length) {
      const note = document.createElement("p");
      note.className = "empty-state";
      note.textContent = "Todavía no hay productos publicados. Empieza con el formulario de abajo.";
      adminProducts.append(note);
      return;
    }
    products.forEach((product) => {
      const row = document.createElement("article");
      row.className = "admin-product";
      const title = document.createElement("p");
      title.textContent = `${product.title} · ${product.variants.length} ${product.variants.length === 1 ? "diseño" : "diseños"}`;
      const actions = document.createElement("div");
      actions.className = "admin-product-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "button button-secondary button-small";
      edit.textContent = "Editar";
      edit.addEventListener("click", () => editProduct(product));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "button button-secondary button-small";
      remove.textContent = "Retirar pieza";
      remove.addEventListener("click", () => removeProduct(product));
      actions.append(edit, remove);
      row.append(title, actions);
      adminProducts.append(row);
    });
  }

  function storedMedia(form = productForm) {
    try { return JSON.parse(form.dataset.baseMedia || "[]"); }
    catch { return []; }
  }

  function showStoredMedia() {
    existingMediaList.replaceChildren();
    const media = storedMedia();
    if (!media.length) return;
    const label = document.createElement("strong");
    label.textContent = "Archivos ya guardados (pulsa Quitar para retirarlos):";
    existingMediaList.append(label);
    media.forEach((item, index) => {
      const line = document.createElement("div");
      line.className = "admin-product";
      const name = document.createElement("span");
      name.textContent = item.type === "video" ? "Video de elaboración" : item.alt || `Foto ${index + 1}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "button button-secondary button-small";
      remove.textContent = "Quitar";
      remove.setAttribute("aria-label", `Quitar ${name.textContent}`);
      remove.addEventListener("click", () => {
        const updated = storedMedia();
        updated.splice(index, 1);
        productForm.dataset.baseMedia = JSON.stringify(updated);
        showStoredMedia();
      });
      line.append(name, remove);
      existingMediaList.append(line);
    });
  }

  function addVariantRow(variant = {}) {
    if (!variant.id && variantRows.children.length >= 8) {
      saveMessage.textContent = "Puedes añadir hasta 8 diseños o colores por pieza.";
      return;
    }
    const row = document.createElement("div");
    row.className = "admin-variant-row";
    row.dataset.variantId = variant.id || crypto.randomUUID();
    row.dataset.media = JSON.stringify(Array.isArray(variant.media) ? variant.media : []);
    const nameWrap = document.createElement("div");
    nameWrap.className = "field";
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Diseño o color";
    const name = document.createElement("input");
    name.type = "text";
    name.maxLength = 55;
    name.placeholder = "Verde esmeralda";
    name.value = variant.name || "";
    name.setAttribute("aria-label", "Nombre del diseño o color");
    nameWrap.append(nameLabel, name);

    const colorWrap = document.createElement("div");
    colorWrap.className = "field";
    const colorLabel = document.createElement("label");
    colorLabel.textContent = "Color";
    const color = document.createElement("input");
    color.type = "color";
    color.value = /^#[0-9a-f]{6}$/i.test(variant.color || "") ? variant.color : "#d29c4c";
    color.setAttribute("aria-label", "Color de muestra");
    colorWrap.append(colorLabel, color);

    const priceWrap = document.createElement("div");
    priceWrap.className = "field";
    const priceLabel = document.createElement("label");
    priceLabel.textContent = "Precio S/";
    const price = document.createElement("input");
    price.type = "number";
    price.min = "0.01";
    price.step = "0.01";
    price.placeholder = "Base";
    price.value = Number(variant.price) > 0 ? String(variant.price) : "";
    price.setAttribute("aria-label", "Precio opcional de este diseño");
    priceWrap.append(priceLabel, price);

    const photoWrap = document.createElement("div");
    photoWrap.className = "field admin-variant-photo";
    const photoLabel = document.createElement("label");
    photoLabel.textContent = variant.media?.length ? "Añadir/reemplazar foto" : "Foto del diseño";
    const photo = document.createElement("input");
    photo.type = "file";
    photo.accept = "image/jpeg,image/png,image/webp";
    photo.setAttribute("aria-label", "Foto para este diseño o color");
    photoWrap.append(photoLabel, photo);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "variant-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Quitar este diseño o color");
    remove.addEventListener("click", () => row.remove());
    row.append(nameWrap, colorWrap, priceWrap, photoWrap, remove);
    variantRows.append(row);
  }

  function clearProductForm() {
    productForm.reset();
    document.getElementById("editProductId").value = "";
    productForm.dataset.baseMedia = "[]";
    variantRows.replaceChildren();
    addVariantRow();
    existingMediaList.replaceChildren();
    document.getElementById("productFormHeading").textContent = "Publicar una pieza";
    document.getElementById("productSaveButton").textContent = "Publicar pieza";
    document.getElementById("cancelEditButton").hidden = true;
    saveMessage.textContent = "";
  }

  function editProduct(product) {
    clearProductForm();
    document.getElementById("editProductId").value = product.id;
    document.getElementById("productTitleInput").value = product.title;
    document.getElementById("productCategoryInput").value = product.category;
    document.getElementById("productPriceInput").value = product.price;
    document.getElementById("productHoursInput").value = product.hours;
    document.getElementById("productTechniqueInput").value = product.technique;
    document.getElementById("productOriginInput").value = product.origin;
    document.getElementById("productDescriptionInput").value = product.description;
    productForm.dataset.baseMedia = JSON.stringify(product.media || []);
    variantRows.replaceChildren();
    (product.variants || []).forEach(addVariantRow);
    if (!variantRows.children.length) addVariantRow();
    showStoredMedia();
    document.getElementById("productFormHeading").textContent = `Editar ${product.title}`;
    document.getElementById("productSaveButton").textContent = "Guardar cambios";
    document.getElementById("cancelEditButton").hidden = false;
    document.getElementById("productFormHeading").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function collectAllMedia(product) {
    return [
      ...(product.media || []),
      ...(product.variants || []).flatMap((variant) => variant.media || [])
    ];
  }

  async function deleteMediaFiles(items) {
    const paths = [...new Set(items.map((item) => item.path).filter(Boolean))];
    if (!paths.length) return;
    const { error } = await supabase.storage.from("product-media").remove(paths);
    if (error) console.warn("Algunos archivos retirados no se pudieron borrar.", error);
  }

  async function removeProduct(product) {
    if (!window.confirm(`¿Retirar “${product.title}” del catálogo?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      saveMessage.textContent = "No se pudo retirar la pieza. Verifica que la cuenta de Rosa esté autorizada.";
      return;
    }
    await deleteMediaFiles(collectAllMedia(product));
    saveMessage.textContent = "Pieza retirada del catálogo.";
    await showOwnerProducts();
    await refreshPublicCatalog();
  }

  async function checkVideo(file) {
    if (!file) return;
    if (!/^video\/(mp4|webm)$/.test(file.type)) throw new Error("El video debe ser MP4 o WebM.");
    if (file.size > 25 * 1024 * 1024) throw new Error("El video no puede superar 25 MB.");
    const url = URL.createObjectURL(file);
    try {
      const duration = await new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        const timeout = window.setTimeout(() => reject(new Error("No pudimos leer la duración del video.")), 10000);
        video.onloadedmetadata = () => { window.clearTimeout(timeout); resolve(video.duration); };
        video.onerror = () => { window.clearTimeout(timeout); reject(new Error("No pudimos leer la duración del video.")); };
        video.src = url;
      });
      if (!Number.isFinite(duration) || duration > 60) throw new Error("El video debe durar 60 segundos o menos.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function uploadMedia(file, type, productId, userId) {
    const extension = file.name.split(".").pop().toLocaleLowerCase("es").replace(/[^a-z0-9]/g, "") || (type === "video" ? "mp4" : "jpg");
    const path = `${userId}/${productId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("product-media").upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;
    const { data } = supabase.storage.from("product-media").getPublicUrl(path);
    return {
      id: crypto.randomUUID(),
      type,
      url: data.publicUrl,
      path,
      contentType: file.type,
      alt: type === "image" ? file.name.replace(/\.[^.]+$/, "") : "Video de elaboración"
    };
  }

  function oldFilesNotKept(oldProduct, nextProduct) {
    const nextPaths = new Set(collectAllMedia(nextProduct).map((item) => item.path).filter(Boolean));
    return collectAllMedia(oldProduct).filter((item) => item.path && !nextPaths.has(item.path));
  }

  async function saveProduct(event) {
    event.preventDefault();
    const message = saveMessage;
    const sessionResult = await supabase.auth.getSession();
    const user = sessionResult.data.session?.user;
    const { data: isOwner, error: ownerError } = user
      ? await supabase.rpc("is_rosabel_owner_current")
      : { data: false, error: new Error("No hay una sesión activa") };
    if (!user || ownerError || isOwner !== true) {
      message.textContent = "Vuelve a iniciar sesión con el correo autorizado de Rosa.";
      return;
    }
    const photos = [...document.getElementById("productImagesInput").files];
    const video = document.getElementById("productVideoInput").files[0];
    const variantInputs = [...variantRows.children].map((row) => ({
      row,
      id: row.dataset.variantId,
      media: JSON.parse(row.dataset.media || "[]"),
      name: row.querySelector('input[type="text"]').value.trim(),
      color: row.querySelector('input[type="color"]').value,
      price: row.querySelector('input[type="number"]').value,
      file: row.querySelector('input[type="file"]').files[0]
    }));
    if (photos.length > 8) return message.textContent = "Puedes elegir hasta 8 fotos del producto.";
    const allImages = [...photos, ...variantInputs.map((item) => item.file).filter(Boolean)];
    if (allImages.some((file) => !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024)) {
      return message.textContent = "Cada foto debe ser JPG, PNG o WebP y pesar máximo 8 MB.";
    }
    if (video) {
      try { await checkVideo(video); }
      catch (error) { message.textContent = error.message; return; }
    }
    const productId = document.getElementById("editProductId").value || crypto.randomUUID();
    const previous = document.getElementById("editProductId").value
      ? (await cloudProducts(true)).find((item) => item.id === productId)
      : null;
    const uploaded = [];
    const uploadedVariants = [];
    message.textContent = "Subiendo fotos y guardando la pieza…";
    document.getElementById("productSaveButton").disabled = true;
    try {
      let media = storedMedia();
      if (video) media = media.filter((item) => item.type !== "video");
      for (const file of photos) uploaded.push(await uploadMedia(file, "image", productId, user.id));
      if (video) uploaded.push(await uploadMedia(video, "video", productId, user.id));
      media = [...media, ...uploaded];

      const variants = [];
      for (const input of variantInputs) {
        if (!input.name && !input.file && !input.price) continue;
        if (!input.name) throw new Error("Escribe el nombre de cada diseño o color que añadas.");
        let variantMedia = input.media;
        if (input.file) {
          uploadedVariants.push(await uploadMedia(input.file, "image", productId, user.id));
          variantMedia = [...variantMedia, uploadedVariants[uploadedVariants.length - 1]];
        }
        variants.push({
          id: input.id,
          name: input.name,
          color: input.color,
          price: input.price ? Number(input.price) : null,
          media: variantMedia
        });
      }
      if (!variants.length) variants.push({ id: crypto.randomUUID(), name: "Diseño disponible", color: "", price: null, media: [] });
      if (!media.some((item) => item.type === "image")) throw new Error("Añade al menos una foto principal del producto.");

      const row = {
        id: productId,
        owner_id: user.id,
        title: document.getElementById("productTitleInput").value.trim(),
        category: document.getElementById("productCategoryInput").value.trim(),
        price: Number(document.getElementById("productPriceInput").value),
        hours: Number(document.getElementById("productHoursInput").value),
        technique: document.getElementById("productTechniqueInput").value.trim(),
        origin: document.getElementById("productOriginInput").value.trim(),
        description: document.getElementById("productDescriptionInput").value.trim(),
        artisan: "Rosa Bertha Llontop Lluen",
        media,
        variants,
        published: true,
        updated_at: new Date().toISOString()
      };
      const request = previous
        ? supabase.from("products").update(row).eq("id", productId)
        : supabase.from("products").insert(row);
      const { error } = await request;
      if (error) throw error;
      if (previous) await deleteMediaFiles(oldFilesNotKept(previous, row));
      message.textContent = "La pieza quedó publicada en el catálogo.";
      await showOwnerProducts();
      await refreshPublicCatalog();
      clearProductForm();
      message.textContent = "La pieza quedó publicada en el catálogo.";
    } catch (error) {
      console.error("No se pudo guardar la pieza.", error);
      await deleteMediaFiles([...uploaded, ...uploadedVariants]);
      message.textContent = error.message?.includes("row-level security")
        ? "La cuenta aún no tiene permiso. Revisa que el correo de Rosa esté en la lista privada de Supabase."
        : error.message || "No pudimos guardar la pieza. Revisa la conexión e inténtalo otra vez.";
    } finally {
      document.getElementById("productSaveButton").disabled = false;
    }
  }

  adminButton.addEventListener("click", async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (user) {
      if (await setLoggedIn()) await showOwnerProducts();
      else await supabase.auth.signOut();
    } else {
      loginView.hidden = false;
      panelView.hidden = true;
      loginMessage.textContent = "";
    }
    adminDialog.showModal();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("adminEmail").value.trim();
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    loginMessage.textContent = "Enviando el enlace de acceso…";
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`
        }
      });
      if (error) {
        const redirectProblem = error.message?.toLowerCase().includes("redirect");
        setLoginError(redirectProblem
          ? "Falta autorizar la dirección de Rosabel en Supabase. Avísale a quien administra la tienda."
          : "No pudimos enviar el enlace. Revisa el correo e inténtalo otra vez.");
        return;
      }
      loginMessage.dataset.kind = "success";
      loginMessage.textContent = "Revisa el correo de Rosa y abre el enlace desde este mismo navegador para entrar.";
    } finally {
      submitButton.disabled = false;
    }
  });

  document.getElementById("adminSignOutButton").addEventListener("click", async () => {
    await supabase.auth.signOut();
    panelView.hidden = true;
    loginView.hidden = false;
    loginMessage.textContent = "Sesión cerrada.";
  });
  document.getElementById("addVariantButton").addEventListener("click", () => addVariantRow());
  document.getElementById("cancelEditButton").addEventListener("click", clearProductForm);
  document.getElementById("productImagesInput").addEventListener("change", (event) => {
    const files = [...event.target.files];
    if (files.length > 8) event.target.value = "";
    saveMessage.textContent = files.length > 8 ? "Elige hasta 8 fotos para el producto." : `${files.length} ${files.length === 1 ? "foto seleccionada" : "fotos seleccionadas"}.`;
  });
  document.getElementById("productVideoInput").addEventListener("change", async (event) => {
    try { await checkVideo(event.target.files[0]); saveMessage.textContent = "Video listo (máximo 60 segundos)."; }
    catch (error) { event.target.value = ""; saveMessage.textContent = error.message; }
  });
  productForm.addEventListener("submit", saveProduct);

  const { data: sessionData } = await supabase.auth.getSession();
  const savedUser = sessionData.session?.user;
  if (savedUser) {
    const { data: isOwner, error } = await supabase.rpc("is_rosabel_owner_current");
    if (!error && isOwner !== true) await supabase.auth.signOut();
  }
  await refreshPublicCatalog();
}
