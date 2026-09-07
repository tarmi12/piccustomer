const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Api = {
  // ดึงข้อมูลบิล
  async getCustomer(billNumber) {
    const { data, error } = await db
      .from("customers")
      .select("*")
      .eq("bill_number", billNumber)
      .single();
    if (error && error.code !== "PGRST116") {
      console.error(error);
    }
    return data || null;
  },

  // อัปโหลดรูปลง Supabase Storage
  async uploadImage(billNumber, stationId, dataUrl, index) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const timestamp = Date.now();
    const filePath = `${billNumber}/station${stationId}/${timestamp}_${index + 1}.jpg`;

    const { data, error } = await db.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, blob, {
        contentType: "image/jpeg",
        upsert: true
      });

    if (error) throw error;

    const { data: publicData } = db.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    return publicData.publicUrl;
  },

  // บันทึกข้อมูลของ Station นั้นๆ
  async saveStation(billNumber, stationId, imageUrls) {
    let existing = await this.getCustomer(billNumber);

    const updatePayload = {
      bill_number: billNumber,
      [`station${stationId}_status`]: "DONE",
      [`station${stationId}_thumbs`]: imageUrls,
      [`station${stationId}_time`]: new Date().toISOString()
    };

    if (!existing) {
      const { error } = await db.from("customers").insert([updatePayload]);
      if (error) throw error;
    } else {
      const { error } = await db.from("customers")
        .update(updatePayload)
        .eq("bill_number", billNumber);
      if (error) throw error;
    }
  }
};
