
package bri;

import java.sql.*;

public class BRI {
    
    //JDBC driver name and database URL
    static final String JDBC_DRIVER = "org.mariadb.jdbc.Driver";  
    static final String DB_URL = "jdbc:mariadb://localhost:3306/wiki";

    //Database credentials
    static final String USER = "root";
    static final String PASS = ""; //Insert DB password
   
    
    public static void main(String[] args) throws ClassNotFoundException, SQLException {
   
        Connection conn = null;
        Statement stmt = null;
        try{
            // Register JDBC driver
            Class.forName(JDBC_DRIVER);
            
            // Open a connection
            System.out.println("Connecting to database...");
            conn = DriverManager.getConnection(DB_URL,USER,PASS);

            // Create and execute query
            System.out.println("Creating statement...");
            stmt = conn.createStatement();
            
            int minimo = 0;
            int intervalo = 4999;
            int maximo = 857595976;
            ResultSet res = null;
            
            
            while(minimo <= maximo){
                res = stmt.executeQuery("SELECT old_text, old_id FROM text WHERE old_id BETWEEN "+minimo+" AND "+ (minimo+intervalo));
                
                // Get next result from the query
                while(res.next()){
                    // Get the text from the result
                    String text = res.getString("old_text");
                    // Get the ID from the result
                    int id = res.getInt("old_id");
                    
                    
                    if(text.contains("<math>")){
                        System.out.println("\nID: "+id);
                        stmt.executeQuery("UPDATE text SET old_math = 1 WHERE old_id = "+id);
                    }
                   
                }
                minimo = minimo+intervalo+1;
            }
            
            
          
            // Clean-up environment
            res.close();
            stmt.close();
            conn.close();
        }catch(SQLException | ClassNotFoundException se){
            //Handle errors for JDBC
        }
        //Handle errors for Class.forName
        finally{
            //finally block used to close resources
            try{
               if(stmt!=null)
                  stmt.close();
            }catch(SQLException se2){
            }// nothing we can do
            try{
               if(conn!=null)
                  conn.close();
            }catch(SQLException se){
            }//end finally try
        }//end try
        System.out.println("\nGoodbye!\n");
    }
    
}
