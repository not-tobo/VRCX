// Copyright(c) 2019-2020 pypy. All rights reserved.
//
// This work is licensed under the terms of the MIT license.
// For a copy, see <https://opensource.org/licenses/MIT>.

using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using LiteDB;

namespace VRCX
{
    public class LiteDB
    {
        public static readonly LiteDB Instance;
        public static string AvatarDatabasePath = String.Empty;

        static LiteDB()
        {
            Instance = new LiteDB();
        }

        public class AvatarCache
        {
            public string _id { get; set; }
            public string Name { get; set; }
            public string Description { get; set; }
            public string AuthorId { get; set; }
            public string AuthorName { get; set; }
            public string ImageUrl { get; set; }
            public string ThumbnailUrl { get; set; }
            public string ReleaseStatus { get; set; }
            public string Platform { get; set; }
            public string SupportedPlatforms { get; set; }
            public DateTime CreatedAt { get; set; }
            public DateTime UpdatedAt { get; set; }

            public DateTime AddedOn { get; set; }
            public string Category { get; set; }
            public int id { get; set; }
        }

        public class AvatarFavorites
        {
            public int _id { get; set; }
            public DateTime AddedOn { get; set; }
            public string Category { get; set; }
            public string ObjectId { get; set; }
        }

        public class AvatarCategories
        {
            public string _id { get; set; }
            public string SortType { get; set; }
            public int VisibleRows { get; set; }
        }

        public bool CheckAvatarDatabase()
        {
            using (var key = Registry.ClassesRoot.OpenSubKey(@"VRChat\shell\open\command"))
            {
                var path = String.Empty;
                var match = Regex.Match(key.GetValue(string.Empty) as string, "(?!\")(.+?\\\\VRChat.*)(!?\\\\launch.exe\")");
                if (match.Success == true)
                {
                    path = match.Groups[1].Value;
                }
                AvatarDatabasePath = Path.Combine(path, "UserData\\");
                if (Directory.Exists(AvatarDatabasePath) && File.Exists($"{AvatarDatabasePath}favcat-favs.db") && File.Exists($"{AvatarDatabasePath}favcat-store.db"))
                {
                    return true;
                }
                return false;
            }
        }

        public void InsertAvatarFav(string Data)
        {
            var json = System.Text.Json.JsonSerializer.Deserialize<AvatarCache>(Data);
            using (var AvatarFavDb = new LiteDatabase($"Filename={AvatarDatabasePath}favcat-favs.db"))
            {
                var AvatarFavData = AvatarFavDb.GetCollection<AvatarFavorites>("Avatar_favorites");
                var AvatarFavItem = AvatarFavData.FindOne(Query.And(Query.EQ("ObjectId", json._id), Query.EQ("Category", json.Category)));
                if (AvatarFavItem == null)
                {
                    var Avatar = new AvatarFavorites
                    {
                        ObjectId = json._id,
                        Category = json.Category,
                        AddedOn = DateTime.UtcNow
                    };
                    AvatarFavData.Insert(Avatar);
                }
            }
            using (var AvatarCacheDb = new LiteDatabase($"Filename={AvatarDatabasePath}favcat-store.db"))
            {
                var AvatarCacheData = AvatarCacheDb.GetCollection<AvatarCache>("avatars");
                var AvatarCacheItem = AvatarCacheData.FindById(json._id);
                var Avatar = new AvatarCache
                {
                    _id = json._id,
                    Name = json.Name,
                    Description = json.Description,
                    AuthorId = json.AuthorId,
                    AuthorName = json.AuthorName,
                    ImageUrl = json.ImageUrl,
                    ThumbnailUrl = json.ThumbnailUrl,
                    ReleaseStatus = json.ReleaseStatus,
                    Platform = "standalonewindows",
                    SupportedPlatforms = "StandaloneWindows",
                    CreatedAt = json.CreatedAt,
                    UpdatedAt = json.UpdatedAt
                };
                if (AvatarCacheItem != null)
                {
                    AvatarCacheData.Update(Avatar);
                }
                else
                {
                    AvatarCacheData.Insert(Avatar);
                }
            }
        }

        public bool RemoveAvatarFav(string Data)
        {
            var json = System.Text.Json.JsonSerializer.Deserialize<AvatarFavorites>(Data);
            using (var AvatarFavDb = new LiteDatabase($"Filename={AvatarDatabasePath}favcat-favs.db"))
            {
                var AvatarFavData = AvatarFavDb.GetCollection<AvatarFavorites>("Avatar_favorites");
                var AvatarFavItem = AvatarFavData.FindOne(Query.And(Query.EQ("ObjectId", json.ObjectId), Query.EQ("Category", json.Category)));
                if (AvatarFavItem != null)
                {
                    AvatarFavData.Delete(AvatarFavItem._id);
                    return true;
                }
            }
            return false;
        }

        public string RemoveAllAvatarFav(string Data)
        {
            var json = System.Text.Json.JsonSerializer.Deserialize<AvatarFavorites>(Data);
            var AvatarFavList = new List<AvatarFavorites>();
            using (var AvatarFavDb = new LiteDatabase($"Filename={AvatarDatabasePath}favcat-favs.db"))
            {
                var AvatarFavData = AvatarFavDb.GetCollection<AvatarFavorites>("Avatar_favorites");
                var AvatarFavItems = AvatarFavData.Find(Query.EQ("ObjectId", json.ObjectId));
                foreach (var Avatar in AvatarFavItems)
                {
                    AvatarFavList.Add(Avatar);
                    AvatarFavData.Delete(Avatar._id);
                }
            }
            var jsonOut = System.Text.Json.JsonSerializer.Serialize(AvatarFavList);
            return jsonOut;
        }

        public string GetAvatarFavCategories(bool isGameRunning)
        {
            var FavsDB = $"{AvatarDatabasePath}favcat-favs.db";
            if (isGameRunning)
            {
                System.IO.File.Copy($"{AvatarDatabasePath}favcat-favs.db", $"{AvatarDatabasePath}temp-favs.db", true);
                FavsDB = $"{AvatarDatabasePath}temp-favs.db";
            }
            var AvatarCategoryList = new List<AvatarCategories>();
            using (var AvatarFavDb = new LiteDatabase($"Filename={FavsDB}"))
            {
                var AvatarFavCategoryData = AvatarFavDb.GetCollection<AvatarCategories>("Avatar_categories");
                var AllFavCategories = AvatarFavCategoryData.FindAll();
                foreach (var Category in AllFavCategories)
                {
                    AvatarCategoryList.Add(Category);
                }
            }
            if (File.Exists($"{AvatarDatabasePath}temp-favs.db"))
            {
                System.IO.File.Delete($"{AvatarDatabasePath}temp-favs.db");
            }
            var json = System.Text.Json.JsonSerializer.Serialize(AvatarCategoryList);
            return json;
        }

        public void AddAvatarFavCategory(string Data)
        {
            var json = System.Text.Json.JsonSerializer.Deserialize<AvatarCategories>(Data);
            using (var AvatarFavDb = new LiteDatabase($"Filename={AvatarDatabasePath}favcat-favs.db"))
            {
                var AvatarFavCategoryData = AvatarFavDb.GetCollection<AvatarCategories>("Avatar_categories");
                var AvatarFavCategory = AvatarFavCategoryData.FindById(json._id);
                var Category = new AvatarCategories
                {
                    _id = json._id,
                    SortType = json.SortType,
                    VisibleRows = json.VisibleRows

                };
                if (AvatarFavCategory != null)
                {
                    AvatarFavCategoryData.Update(Category);
                }
                else
                {
                    AvatarFavCategoryData.Insert(Category);
                }
            }
        }

        public bool RemoveAvatarFavCategory(string Category)
        {
            using (var AvatarFavDb = new LiteDatabase($"Filename={AvatarDatabasePath}favcat-favs.db"))
            {
                var AvatarFavData = AvatarFavDb.GetCollection<AvatarFavorites>("Avatar_favorites");
                var AvatarFavCategoryData = AvatarFavDb.GetCollection<AvatarCategories>("Avatar_categories");
                var AvatarFavCategory = AvatarFavCategoryData.FindOne(Query.EQ("_id", Category));
                if (AvatarFavCategory != null)
                {
                    AvatarFavCategoryData.Delete(AvatarFavCategory._id);
                    var AvatarFavItems = AvatarFavData.Find(Query.EQ("Category", Category));
                    foreach (var Avatar in AvatarFavItems)
                    {
                        AvatarFavData.Delete(Avatar._id);
                    }
                    return true;
                }
            }
            return false;
        }

        public string GetAvatarFavs(bool isGameRunning)
        {
            var FavsDB = $"{AvatarDatabasePath}favcat-favs.db";
            var StoreDB = $"{AvatarDatabasePath}favcat-store.db";
            if (isGameRunning)
            {
                System.IO.File.Copy($"{AvatarDatabasePath}favcat-favs.db", $"{AvatarDatabasePath}temp-favs.db", true);
                System.IO.File.Copy($"{AvatarDatabasePath}favcat-store.db", $"{AvatarDatabasePath}temp-store.db", true);
                FavsDB = $"{AvatarDatabasePath}temp-favs.db";
                StoreDB = $"{AvatarDatabasePath}temp-store.db";
            }
            var AvatarFavList = new List<AvatarCache>();
            using (var AvatarFavDb = new LiteDatabase($"Filename={FavsDB}"))
            {
                var AvatarFavData = AvatarFavDb.GetCollection<AvatarFavorites>("Avatar_favorites");
                using (var AvatarCacheDb = new LiteDatabase($"Filename={StoreDB}"))
                {
                    var AvatarCacheData = AvatarCacheDb.GetCollection<AvatarCache>("avatars");
                    var AllAvatarFavs = AvatarFavData.FindAll();
                    foreach (var Avatar in AllAvatarFavs)
                    {
                        var AvatarCacheItem = AvatarCacheData.FindById(Avatar.ObjectId);
                        if (AvatarCacheItem != null)
                        {
                            AvatarCacheItem.Category = Avatar.Category;
                            AvatarCacheItem.AddedOn = Avatar.AddedOn;
                            AvatarCacheItem.id = Avatar._id;
                            AvatarFavList.Add(AvatarCacheItem);
                        }
                    }
                }
            }
            if (File.Exists($"{AvatarDatabasePath}temp-favs.db") && File.Exists($"{AvatarDatabasePath}temp-store.db"))
            {
                System.IO.File.Delete($"{AvatarDatabasePath}temp-favs.db");
                System.IO.File.Delete($"{AvatarDatabasePath}temp-store.db");
            }
            var json = System.Text.Json.JsonSerializer.Serialize(AvatarFavList);
            return json;
        }

        public string GetAvatarAllCache(bool isGameRunning)
        {
            var StoreDB = $"{AvatarDatabasePath}favcat-store.db";
            if (isGameRunning)
            {
                System.IO.File.Copy($"{AvatarDatabasePath}favcat-store.db", $"{AvatarDatabasePath}temp-store.db", true);
                StoreDB = $"{AvatarDatabasePath}temp-store.db";
            }
            var AvatarCacheList = new List<AvatarCache>();
            using (var AvatarCacheDb = new LiteDatabase($"Filename={StoreDB}"))
            {
                var AvatarCacheData = AvatarCacheDb.GetCollection<AvatarCache>("avatars");
                var AllAvatarCache = AvatarCacheData.FindAll();
                foreach (var Avatar in AllAvatarCache)
                {
                    AvatarCacheList.Add(Avatar);
                }
            }
            if (File.Exists($"{AvatarDatabasePath}temp-store.db"))
            {
                System.IO.File.Delete($"{AvatarDatabasePath}temp-store.db");
            }
            var json = System.Text.Json.JsonSerializer.Serialize(AvatarCacheList);
            return json;
        }
    }
}
