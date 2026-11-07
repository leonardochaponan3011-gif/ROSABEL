(function () {
  const config = window.ROSABEL_CONFIG || {};
  const key = config.supabaseAnonKey || config.publishableKey || "";
  const publicBase = "https://leonardochaponan3011-gif.github.io/ROSABEL/";
  const loginCard = document.getElementById("loginCard");
  const loginForm = document.getElementById("loginForm");
  const loginMessage = document.getElementById("loginMessage");
  const ownerPanel = document.getElementById("ownerPanel");
  const ownerTitle = document.getElementById("ownerTitle");
  const profileForm = document.getElementById("profileForm");
  const profileMessage = document.getElementById("profileMessage");
  const productPanel = document.getElementById("productPanel");
  const productForm = document.getElementById("productForm");
  const productMessage = document.getElementById("productMessage");
  const productsMessage = document.getElementById("productsMessage");
  const productTitle = document.getElementById("productTitle");
  const productsList = document.getElementById("myProducts");
  const photoInput = document.getElementById("artisanPhoto");
  const productPhotosInput = document.getElementById("piecePhotos");
  const productVideoInput = document.getElementById("pieceVideo");
  const productSaveButton = document.getElementById("saveProductButton");
  const cancelEditButton = document.getElementById("cancelEditButton");
  const publicProfileLink = document.getElementById("publicProfileLink");

  if (!config.supabaseUrl || !key || !window.supabase?.createClient) {
    loginMessage.textContent = "No pudimos conectar con Kamay. Inténtalo de nuevo más tarde.";
    loginMessage.dataset.kind = "error";
    return;
  }

  const supabase = window.supabase.createClient(config.supabaseUrl, key, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });
  let currentUser = null;
  let currentProfile = null;
  let ownerProducts = [];
  let editingProduct = null;
  let loadSequence = 0;

  function setMessage(element, message, kind = "info") {
    element.textContent = message;
    if (kind === "error") element.dataset.kind = "error";
    else delete element.dataset.kind;
  }

  function slugify(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function extensionFor(file) {
    const extensions = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "video/mp4": "mp4",
      "video/webm": "webm"
    };
    return extensions[file.type] || "";
  }

  async function uploadFile(file, folder, description) {
    const extension = extensionFor(file);
    if (!extension) throw new Error("El archivo debe ser JPG, PNG, WebP, MP4 o WebM.");
    const path = `${currentUser.id}/${folder}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("artisan-media").upload(path, file, {
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;
    const { data } = supabase.storage.from("artisan-media").getPublicUrl(path);
    return { type: file.type.startsWith("video/") ? "video" : "image", url: data.publicUrl, path, alt: description };
  }

  function removeUploadedMedia(items) {
    const paths = items.map((item) => item.path).filter(Boolean);
    return paths.length ? supabase.storage.from("artisan-media").remove(paths) : Promise.resolve({ error: null });
  }

  function validateImage(file) {
    return ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 8 * 1024 * 1024;
  }

  function validateVideo(file) {
    if (!["video/mp4", "video/webm"].includes(file.type) || file.size > 25 * 1024 * 1024) {
      return Promise.reject(new Error("El video debe ser MP4 o WebM y pesar máximo 25 MB."));
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const duration = video.duration;
        URL.revokeObjectURL(url);
        if (!Number.isFinite(duration) || duration > 60) reject(new Error("El video debe durar máximo 60 segundos."));
        else resolve(true);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No pudimos leer el video. Prueba con un archivo MP4 o WebM."));
      };
      video.src = url;
    });
  }

  function makePublicLink() {
    if (!currentProfile?.slug) {
      publicProfileLink.hidden = true;
      return;
    }
    publicProfileLink.href = `${publicBase}espacio-artesana.html?slug=${encodeURIComponent(currentProfile.slug)}`;
    publicProfileLink.hidden = false;
    publicProfileLink.textContent = currentProfile.published ? "Ver mi espacio público" : "Ver dirección de mi espacio (actualmente oculto)";
  }

  function fillProfileForm(profile) {
    document.getElementById("shopName").value = profile?.shop_name || "";
    document.getElementById("artisanName").value = profile?.artisan_name || "";
    document.getElementById("artisanLocation").value = profile?.location || "";
    document.getElementById("artisanWhatsapp").value = profile?.whatsapp || "";
    document.getElementById("artisanStory").value = profile?.story || "";
    document.getElementById("profilePublished").checked = profile ? profile.published : true;
  }

  async function loadProducts() {
    productsList.replaceChildren();
    setMessage(productsMessage, "");
    const { data, error } = await supabase.from("artisan_products")
      .select("id,title,price,hours,technique,category,description,published,variants,media,created_at")
      .eq("artisan_id", currentUser.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    ownerProducts = data || [];
    if (!ownerProducts.length) {
      const note = document.createElement("p");
      note.className = "muted-note";
      note.textContent = "Todavía no tienes productos. Cuando publiques uno, aquí podrás editarlo o eliminarlo.";
      productsList.append(note);
      return;
    }
    ownerProducts.forEach((product) => {
      const row = document.createElement("article");
      row.className = "product-row";
      const productPhoto = Array.isArray(product.media)
        ? product.media.find((item) => item?.type === "image" && item.url)
        : null;
      if (productPhoto) {
        const thumbnail = document.createElement("img");
        thumbnail.className = "product-row-thumb";
        thumbnail.src = productPhoto.url;
        thumbnail.alt = `Foto de ${product.title}`;
        thumbnail.loading = "lazy";
        row.append(thumbnail);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "product-row-thumb product-row-thumb-placeholder";
        placeholder.textContent = "Sin foto";
        placeholder.setAttribute("aria-hidden", "true");
        row.append(placeholder);
      }
      const details = document.createElement("p");
      const variants = Array.isArray(product.variants) ? product.variants.length : 0;
      details.textContent = `${product.title} · S/ ${Number(product.price).toFixed(2)}`;
      const subline = document.createElement("small");
      subline.textContent = `${variants} ${variants === 1 ? "opción" : "opciones"} · ${product.published ? "Visible en mi tienda" : "Oculta"}`;
      details.append(subline);
      const actions = document.createElement("div");
      actions.className = "product-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "button button-secondary";
      edit.textContent = "Editar";
      edit.setAttribute("aria-label", `Editar ${product.title}`);
      edit.title = `Editar ${product.title}`;
      edit.addEventListener("click", () => beginEdit(product));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "button button-danger";
      remove.textContent = "Eliminar";
      remove.setAttribute("aria-label", `Eliminar ${product.title}`);
      remove.title = `Eliminar ${product.title}`;
      remove.addEventListener("click", () => deleteProduct(product));
      actions.append(edit, remove);
      row.append(details, actions);
      productsList.append(row);
    });
  }

  function beginEdit(product) {
    editingProduct = product;
    document.getElementById("pieceName").value = product.title;
    document.getElementById("pieceCategory").value = product.category;
    document.getElementById("piecePrice").value = String(product.price);
    document.getElementById("pieceHours").value = String(product.hours);
    document.getElementById("pieceTechnique").value = product.technique;
    document.getElementById("pieceDescription").value = product.description;
    document.getElementById("pieceVariants").value = (product.variants || []).map((variant) => typeof variant === "string" ? variant : variant.name || "").join(", ");
    document.getElementById("productPublished").checked = product.published;
    productPhotosInput.required = false;
    productTitle.textContent = `Editar producto: ${product.title}`;
    productSaveButton.textContent = "Guardar cambios";
    cancelEditButton.hidden = false;
    setMessage(productMessage, "Elige archivos nuevos si deseas reemplazar las fotos o el video. Si los dejas vacíos, conservaremos los actuales.");
    productForm.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("pieceName").focus({ preventScroll: true });
  }

  function resetProductForm() {
    editingProduct = null;
    productForm.reset();
    document.getElementById("pieceHours").value = "1";
    document.getElementById("productPublished").checked = true;
    productPhotosInput.required = true;
    productTitle.textContent = "Publicar una pieza";
    productSaveButton.textContent = "Publicar pieza";
    cancelEditButton.hidden = true;
    setMessage(productMessage, "");
  }

  async function deleteProduct(product) {
    if (!window.confirm(`¿Eliminar “${product.title}” de tu espacio?`)) return;
    setMessage(productsMessage, `Eliminando “${product.title}”…`);
    try {
      const { error } = await supabase.from("artisan_products").delete().eq("id", product.id);
      if (error) throw error;
      const cleanup = await removeUploadedMedia(product.media || []);
      if (editingProduct?.id === product.id) resetProductForm();
      await loadProducts();
      if (cleanup.error) {
        setMessage(productsMessage, `“${product.title}” se eliminó, pero no pudimos retirar sus fotos y videos.`, "error");
      } else {
        setMessage(productsMessage, `“${product.title}” se eliminó de tu espacio.`);
      }
    } catch (error) {
      console.error("No se pudo eliminar el producto.", error);
      setMessage(productsMessage, "No se pudo eliminar el producto. Inténtalo de nuevo.", "error");
    }
  }

  async function showOwnerPanel(session) {
    const sequence = ++loadSequence;
    currentUser = session.user;
    loginCard.hidden = true;
    ownerPanel.hidden = false;
    ownerTitle.textContent = `Mi espacio · ${currentUser.email || "artesana"}`;
    setMessage(loginMessage, "");

    const { data: profile, error } = await supabase.from("artisan_profiles")
      .select("id,slug,shop_name,artisan_name,location,whatsapp,story,photo_url,published")
      .eq("id", currentUser.id)
      .maybeSingle();
    if (sequence !== loadSequence) return;
    if (error) {
      setMessage(profileMessage, "No pudimos cargar tu perfil. Vuelve a intentarlo.", "error");
      return;
    }
    currentProfile = profile;
    fillProfileForm(currentProfile);
    makePublicLink();
    productPanel.hidden = !currentProfile;
    if (currentProfile) {
      try { await loadProducts(); }
      catch (productError) {
        console.error("No se pudieron cargar tus piezas.", productError);
        setMessage(productMessage, "No pudimos cargar tus piezas. Inténtalo de nuevo.", "error");
      }
    } else {
      setMessage(profileMessage, "Completa tu perfil para abrir tu espacio individual.");
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!currentUser) return;
    setMessage(profileMessage, "Guardando tu espacio…");
    const shopName = document.getElementById("shopName").value.trim();
    const artisanName = document.getElementById("artisanName").value.trim();
    const location = document.getElementById("artisanLocation").value.trim();
    const whatsapp = document.getElementById("artisanWhatsapp").value.replace(/\D/g, "");
    const story = document.getElementById("artisanStory").value.trim();
    if (whatsapp.length < 8 || whatsapp.length > 15) {
      setMessage(profileMessage, "Escribe el WhatsApp con código de país y entre 8 y 15 números.", "error");
      return;
    }

    const uploaded = [];
    try {
      let photoUrl = currentProfile?.photo_url || null;
      const photo = photoInput.files?.[0];
      if (photo) {
        if (!validateImage(photo)) throw new Error("La foto debe ser JPG, PNG o WebP y pesar máximo 8 MB.");
        const saved = await uploadFile(photo, "perfil", `Retrato de ${artisanName}`);
        uploaded.push(saved);
        photoUrl = saved.url;
      }
      const slug = currentProfile?.slug || slugify(shopName);
      if (slug.length < 3 || ["rosabel", "artesanas", "espacio-artesana", "espacio-admin"].includes(slug)) {
        throw new Error("El nombre genera un enlace reservado. Prueba con otro nombre de tienda.");
      }
      const record = {
        id: currentUser.id,
        slug,
        shop_name: shopName,
        artisan_name: artisanName,
        story,
        location,
        whatsapp,
        photo_url: photoUrl,
        published: document.getElementById("profilePublished").checked,
        updated_at: new Date().toISOString()
      };
      let result;
      if (currentProfile) {
        result = await supabase.from("artisan_profiles").update(record).eq("id", currentUser.id)
          .select("id,slug,shop_name,artisan_name,story,location,whatsapp,photo_url,published").single();
      } else {
        result = await supabase.from("artisan_profiles").insert(record)
          .select("id,slug,shop_name,artisan_name,story,location,whatsapp,photo_url,published").single();
      }
      if (result.error) {
        if (result.error.code === "23505") throw new Error("Ese enlace ya está ocupado. Cambia el nombre de tu tienda y vuelve a guardar.");
        throw result.error;
      }
      currentProfile = result.data;
      photoInput.value = "";
      productPanel.hidden = false;
      makePublicLink();
      setMessage(profileMessage, "Tu espacio quedó guardado. Ya puedes publicar tus piezas.");
      try { await loadProducts(); }
      catch (productError) {
        console.error("No se pudieron cargar las piezas de la artesana.", productError);
        setMessage(productMessage, "Tu espacio se guardó, pero no pudimos cargar la lista de piezas.", "error");
      }
    } catch (error) {
      await removeUploadedMedia(uploaded);
      console.error("No se pudo guardar el perfil de la artesana.", error);
      setMessage(profileMessage, error.message || "No se pudo guardar tu espacio. Inténtalo de nuevo.", "error");
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (!currentUser || !currentProfile) {
      setMessage(productMessage, "Primero guarda tu perfil.", "error");
      return;
    }
    setMessage(productMessage, "Guardando la pieza…");
    productSaveButton.disabled = true;
    const photos = Array.from(productPhotosInput.files || []);
    const video = productVideoInput.files?.[0] || null;
    const uploaded = [];
    let productSaved = false;
    try {
      if (photos.length > 8) throw new Error("Puedes agregar hasta 8 fotos por pieza.");
      if (photos.some((file) => !validateImage(file))) throw new Error("Cada foto debe ser JPG, PNG o WebP y pesar máximo 8 MB.");
      if (!editingProduct && !photos.length) throw new Error("Agrega por lo menos una foto para mostrar la pieza.");
      if (video) await validateVideo(video);

      const productId = editingProduct?.id || crypto.randomUUID();
      let media = Array.isArray(editingProduct?.media) ? [...editingProduct.media] : [];
      if (photos.length) media = media.filter((item) => item.type !== "image");
      if (video) media = media.filter((item) => item.type !== "video");
      for (let index = 0; index < photos.length; index += 1) {
        const saved = await uploadFile(photos[index], `piezas/${productId}`, `Foto ${index + 1} de ${document.getElementById("pieceName").value.trim()}`);
        uploaded.push(saved);
        media.push(saved);
      }
      if (video) {
        const saved = await uploadFile(video, `piezas/${productId}`, `Proceso de elaboración de ${document.getElementById("pieceName").value.trim()}`);
        uploaded.push(saved);
        media.push(saved);
      }

      const variants = document.getElementById("pieceVariants").value
        .split(/[,;\n]/).map((name) => name.trim()).filter(Boolean).slice(0, 20)
        .map((name) => ({ name }));
      const record = {
        artisan_id: currentUser.id,
        title: document.getElementById("pieceName").value.trim(),
        category: document.getElementById("pieceCategory").value.trim(),
        price: Number(document.getElementById("piecePrice").value),
        hours: Number(document.getElementById("pieceHours").value),
        technique: document.getElementById("pieceTechnique").value.trim(),
        description: document.getElementById("pieceDescription").value.trim(),
        variants,
        media,
        published: document.getElementById("productPublished").checked,
        updated_at: new Date().toISOString()
      };
      let result;
      if (editingProduct) {
        result = await supabase.from("artisan_products").update(record).eq("id", productId);
      } else {
        result = await supabase.from("artisan_products").insert({ id: productId, ...record });
      }
      if (result.error) throw result.error;
      productSaved = true;
      if (editingProduct && uploaded.length) {
        const replaced = (editingProduct.media || []).filter((item) => photos.length && item.type === "image" || video && item.type === "video");
        await removeUploadedMedia(replaced);
      }
      resetProductForm();
      setMessage(productMessage, "La pieza quedó guardada en tu espacio.");
      try { await loadProducts(); }
      catch (listError) {
        console.error("La pieza se guardó, pero no se pudo actualizar la lista.", listError);
        setMessage(productMessage, "La pieza se guardó. Vuelve a cargar la página para ver la lista actualizada.", "error");
      }
    } catch (error) {
      if (!productSaved) await removeUploadedMedia(uploaded);
      console.error("No se pudo guardar la pieza.", error);
      setMessage(productMessage, error.message || "No se pudo guardar la pieza. Revisa los datos e inténtalo de nuevo.", "error");
    } finally {
      productSaveButton.disabled = false;
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const submit = loginForm.querySelector("button[type=submit]");
    submit.disabled = true;
    setMessage(loginMessage, "Enviando el enlace…");
    let error = null;
    try {
      ({ error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${publicBase}espacio-admin.html`, shouldCreateUser: true }
      }));
    } catch (requestError) {
      error = requestError;
    }
    submit.disabled = false;
    if (error) {
      console.error("No se pudo enviar el enlace de acceso.", error);
      setMessage(loginMessage, "No pudimos enviar el enlace. Revisa el correo e inténtalo de nuevo.", "error");
      return;
    }
    setMessage(loginMessage, "Te enviamos un enlace seguro. Ábrelo desde este navegador para entrar a tu espacio.");
  });

  profileForm.addEventListener("submit", saveProfile);
  productForm.addEventListener("submit", saveProduct);
  cancelEditButton.addEventListener("click", resetProductForm);
  document.getElementById("signOutButton").addEventListener("click", async () => {
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    ownerPanel.hidden = true;
    loginCard.hidden = false;
    setMessage(loginMessage, "Se cerró tu sesión.");
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) setTimeout(() => showOwnerPanel(session), 0);
    else if (event === "SIGNED_OUT") {
      loadSequence += 1;
      ownerPanel.hidden = true;
      loginCard.hidden = false;
    }
  });

  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      setMessage(loginMessage, "No pudimos recuperar tu sesión. Vuelve a solicitar un enlace.", "error");
      return;
    }
    if (data.session?.user) showOwnerPanel(data.session);
  });
})();
