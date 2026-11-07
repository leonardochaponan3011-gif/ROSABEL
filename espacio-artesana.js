(function () {
  const config = window.ROSABEL_CONFIG || {};
  const key = config.supabaseAnonKey || config.publishableKey || "";
  const status = document.getElementById("spaceStatus");
  const slug = new URLSearchParams(window.location.search).get("slug");

  if (!slug) {
    showError("No encontramos el nombre de este espacio. Vuelve al directorio y elige una artesana.");
    return;
  }
  if (!config.supabaseUrl || !key || !window.supabase?.createClient) {
    showError("No pudimos conectar con el directorio. Inténtalo de nuevo más tarde.");
    return;
  }

  const supabase = window.supabase.createClient(config.supabaseUrl, key);

  function showError(message) {
    if (!status) return;
    status.hidden = false;
    status.dataset.kind = "error";
    status.textContent = message;
  }

  function mediaNode(item) {
    if (item.type === "video") {
      const video = document.createElement("video");
      video.controls = true;
      video.preload = "metadata";
      video.playsInline = true;
      video.src = item.url;
      video.setAttribute("aria-label", `Video del proceso de elaboración: ${item.alt || "artesanía"}`);
      return video;
    }
    const image = document.createElement("img");
    image.src = item.url;
    image.alt = item.alt || "Foto de la pieza artesanal";
    image.loading = "lazy";
    return image;
  }

  function renderProduct(product, artisan) {
    const card = document.createElement("article");
    card.className = "product-card";
    const media = document.createElement("div");
    media.className = "product-media";
    const list = Array.isArray(product.media) ? product.media : [];
    const validMedia = list.filter((item) => item && item.url && ["image", "video"].includes(item.type));
    if (validMedia.length) validMedia.forEach((item) => media.append(mediaNode(item)));
    else {
      const emptyMedia = document.createElement("div");
      emptyMedia.className = "media-empty";
      emptyMedia.textContent = "Pieza hecha a mano";
      media.append(emptyMedia);
    }

    const body = document.createElement("div");
    body.className = "product-body";
    const category = document.createElement("span");
    category.className = "product-category";
    category.textContent = product.category;
    const title = document.createElement("h3");
    title.textContent = product.title;
    const description = document.createElement("p");
    description.className = "product-description";
    description.textContent = product.description;
    const facts = document.createElement("p");
    facts.className = "product-facts";
    facts.textContent = `${product.technique} · ${Number(product.hours)} ${Number(product.hours) === 1 ? "hora" : "horas"} de trabajo`;

    const rawVariants = Array.isArray(product.variants) ? product.variants : [];
    const variants = rawVariants.map((variant) => {
      if (typeof variant === "string") return { name: variant, price: null };
      return { name: variant?.name || "Diseño", price: Number(variant?.price) > 0 ? Number(variant.price) : null };
    }).filter((variant) => variant.name);
    let selectedVariant = variants[0] || null;
    let price = Number(product.price);
    const detail = document.createElement("p");
    detail.className = "product-facts";
    detail.textContent = variants.length ? `Diseños: ${variants.map((variant) => variant.name).join(", ")}` : "Pieza artesanal única";

    if (variants.length > 1) {
      const select = document.createElement("select");
      select.className = "variant-select";
      select.setAttribute("aria-label", `Elige un diseño de ${product.title}`);
      variants.forEach((variant, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = variant.name;
        select.append(option);
      });
      select.addEventListener("change", () => {
        selectedVariant = variants[Number(select.value)] || null;
        price = selectedVariant?.price || Number(product.price);
        priceLabel.textContent = `S/ ${price.toFixed(2)}`;
        updateOrderLink();
      });
      body.append(select);
    }

    const bottom = document.createElement("div");
    bottom.className = "product-bottom";
    const priceLabel = document.createElement("strong");
    priceLabel.className = "product-price";
    price = selectedVariant?.price || Number(product.price);
    priceLabel.textContent = `S/ ${price.toFixed(2)}`;
    const order = document.createElement("a");
    order.className = "button button-primary";
    order.target = "_blank";
    order.rel = "noopener noreferrer";
    order.textContent = "Pedir por WhatsApp";
    order.setAttribute("aria-label", `Pedir ${product.title} a ${artisan.artisan_name} por WhatsApp`);
    function updateOrderLink() {
      const selected = selectedVariant ? `, diseño ${selectedVariant.name}` : "";
      const message = `Hola ${artisan.artisan_name}, vi tu espacio y quisiera consultar por ${product.title}${selected}.`;
      order.href = `https://wa.me/${artisan.whatsapp}?text=${encodeURIComponent(message)}`;
    }
    updateOrderLink();
    bottom.append(priceLabel, order);
    body.append(category, title, description, facts, detail, bottom);
    card.append(media, body);
    return card;
  }

  async function loadSpace() {
    const { data: profile, error: profileError } = await supabase
      .from("artisan_profiles")
      .select("id, slug, shop_name, artisan_name, story, location, whatsapp, photo_url, published")
      .eq("slug", slug)
      .maybeSingle();

    if (profileError || !profile) {
      showError("No encontramos este espacio publicado. Revisa el directorio para elegir otra artesana.");
      return;
    }

    document.title = `${profile.shop_name} | Kamay`;
    document.getElementById("profileName").textContent = profile.shop_name;
    document.getElementById("profileLocation").textContent = profile.location;
    document.getElementById("profileByline").textContent = `Creado por ${profile.artisan_name}`;
    document.getElementById("profileStory").textContent = profile.story;

    const contact = document.getElementById("contactArtisan");
    const contactMessage = `Hola ${profile.artisan_name}, quisiera conocer más sobre tus artesanías.`;
    contact.href = `https://wa.me/${profile.whatsapp}?text=${encodeURIComponent(contactMessage)}`;
    contact.target = "_blank";
    contact.rel = "noopener noreferrer";

    if (profile.photo_url) {
      const image = document.getElementById("profilePhoto");
      image.src = profile.photo_url;
      image.alt = `Foto de ${profile.artisan_name}, creadora de ${profile.shop_name}`;
      image.hidden = false;
    } else {
      const initial = document.getElementById("profileInitial");
      initial.textContent = profile.artisan_name.trim().charAt(0).toLocaleUpperCase("es");
      initial.hidden = false;
    }

    document.getElementById("profileHero").hidden = false;
    status.hidden = true;
    const section = document.getElementById("productSection");
    const grid = document.getElementById("productGrid");
    section.hidden = false;
    const { data: products, error: productsError } = await supabase
      .from("artisan_products")
      .select("id, title, price, hours, technique, category, description, media, variants, created_at")
      .eq("artisan_id", profile.id)
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (productsError) {
      const note = document.createElement("p");
      note.className = "empty-state";
      note.textContent = "No pudimos cargar las piezas ahora. Inténtalo de nuevo más tarde.";
      grid.append(note);
      return;
    }
    if (!products?.length) {
      const note = document.createElement("p");
      note.className = "empty-state";
      note.textContent = "Esta artesana está preparando las primeras piezas de su catálogo.";
      grid.append(note);
      return;
    }
    products.forEach((product) => grid.append(renderProduct(product, profile)));
  }

  loadSpace().catch((error) => {
    console.error("No se pudo cargar el espacio de la artesana.", error);
    showError("No pudimos cargar este espacio. Inténtalo de nuevo más tarde.");
  });
})();
